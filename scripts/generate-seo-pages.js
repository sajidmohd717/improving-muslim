/*
 * Generates crawlable, shareable static entry pages for dynamic series and
 * watch routes. The query-based pages remain as compatibility fallbacks, while
 * /series/{slug}/ and /watch/{series}/{episode}/ become canonical.
 *
 *   node scripts/generate-seo-pages.js          rewrite generated pages
 *   node scripts/generate-seo-pages.js --check  fail if generated pages are stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://improvingmuslim.com";
const checkOnly = process.argv.includes("--check");

const seriesTemplate = readFileSync(join(root, "pages/series-detail.html"), "utf8");
const watchTemplate = readFileSync(join(root, "pages/watch.html"), "utf8");

const sandbox = { window: {} };

function loadScript(relativePath) {
  const cleanPath = relativePath.replace(/^\.\//, "").split("?")[0];
  runInNewContext(readFileSync(join(root, cleanPath), "utf8"), sandbox, { filename: cleanPath });
}

loadScript("./data/series-registry.js");
for (const entry of sandbox.window.seriesConfig || []) {
  loadScript(entry.dataFile);
}
loadScript("./data/standalone-lectures-data.js");

const seriesEntries = (sandbox.window.seriesConfig || [])
  .map((entry) => ({ entry, series: sandbox.window[entry.globalKey] }))
  .filter(({ series }) => series && Array.isArray(series.episodes));

const standaloneLectures = sandbox.window.standaloneLectures || [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("\n", " ");
}

function plainText(value = "") {
  return String(value)
    .replace(/`+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarize(value, fallback, max = 180) {
  const text = plainText(value || fallback);
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function pathFromRoot(relativePath) {
  if (!relativePath) return "/public/social-preview.png";
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `/${relativePath.replace(/^\.\//, "").replace(/\\/g, "/")}`;
}

function absoluteUrl(relativePath) {
  if (/^https?:\/\//i.test(relativePath || "")) return relativePath;
  return new URL(pathFromRoot(relativePath), `${ORIGIN}/`).href;
}

function seriesPath(series) {
  return `/series/${encodeURIComponent(series.slug)}/`;
}

function seriesHref(series) {
  return `.${seriesPath(series)}`;
}

function watchPath(series, episode) {
  return `/watch/${encodeURIComponent(series.slug)}/${encodeURIComponent(episode.id)}/`;
}

function watchHref(series, episode) {
  if (!episode?.videoSrc && episode?.youtubeId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(episode.youtubeId)}`;
  }
  return `.${watchPath(series, episode)}`;
}

function standaloneWatchPath(lecture) {
  return `/watch/standalone/${encodeURIComponent(lecture.id)}/`;
}

function standaloneWatchHref(lecture) {
  return `.${standaloneWatchPath(lecture)}`;
}

function isEpisodeAvailable(episode) {
  return Boolean(episode?.videoSrc || episode?.youtubeId);
}

function episodeThumbnailUrl(series, episode) {
  if (episode?.thumbnailSrc) return episode.thumbnailSrc;
  if (series?.episodeThumbnailPath && episode?.number) {
    return `${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`;
  }
  return series?.thumbnailSrc || "./public/social-preview.png";
}

function formatViewCount(n) {
  if (!n) return "";
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K views`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return "";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function isoDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return undefined;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function renderJsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

function renderHead({ base, title, description, canonical, image, ogType = "website", jsonLd, videoUrl }) {
  const imageUrl = absoluteUrl(image || "./public/social-preview.png");
  const safeTitle = escapeAttr(title);
  const safeDescription = escapeAttr(description);
  return `  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="${base}" />
    <meta name="referrer" content="origin" />
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="./public/icon.svg" type="image/svg+xml" />
    <link rel="icon" type="image/png" sizes="32x32" href="./public/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="./public/apple-touch-icon.png" />
    <link rel="manifest" href="./public/site.webmanifest" />
    <meta name="theme-color" content="#176b5b" />
    <meta property="og:site_name" content="Improving Muslim" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${escapeAttr(imageUrl)}" />
    <meta property="og:image:type" content="image/jpeg" />
${videoUrl ? `    <meta property="og:video" content="${escapeAttr(videoUrl)}" />\n` : ""}    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${escapeAttr(imageUrl)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inria+Serif:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles/styles.css?v=20260711-related" />
    <script src="./scripts/theme.js?v=20260705-system-theme"></script>
    <script type="application/ld+json">
${renderJsonLd(jsonLd).split("\n").map((line) => `      ${line}`).join("\n")}
    </script>
    <title>${safeTitle}</title>
  </head>`;
}

function renderSeriesHero({ entry, series }) {
  const availableEpisodes = series.episodes.filter(isEpisodeAvailable);
  const total = entry.episodeCount ?? series.episodes.length;
  const available = entry.availableCount ?? availableEpisodes.length;
  const firstAvailable = availableEpisodes[0];
  const cta = firstAvailable
    ? `<div class="series-cta-row"><a class="series-cta-btn" href="${escapeAttr(watchHref(series, firstAvailable))}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start watching</a></div>`
    : "";
  const availability = available < total
    ? `<p class="series-avail-note">${available} of ${total} episodes available now. More are being uploaded.</p>`
    : "";
  return `      <section class="series-hero">
        <div>
          <p class="eyebrow">${escapeHtml(series.topic || entry.sectionTitle || "Series")}</p>
          <h1>${escapeHtml(series.title)}</h1>
          <p class="hero-copy">${escapeHtml(series.description || entry.description || "")}</p>
          ${cta}
          ${availability}
        </div>
        <img src="${escapeAttr(series.thumbnailSrc || entry.thumbnailSrc || "./public/social-preview.png")}" alt="${escapeAttr(series.title)} series thumbnail" />
      </section>`;
}

function renderSeriesEpisodeCards(series) {
  return series.episodes
    .map((episode, index) => {
      const available = isEpisodeAvailable(episode);
      const isYouTubeOnly = !episode.videoSrc && Boolean(episode.youtubeId);
      const href = available ? ` href="${escapeAttr(watchHref(series, episode))}"` : "";
      const targetAttr = isYouTubeOnly ? ' target="_blank" rel="noopener noreferrer"' : "";
      const date = formatDate(episode.published);
      const duration = formatDuration(episode.duration);
      const meta = [date, duration].filter(Boolean).join(" - ");
      const content = `
            <img src="${escapeAttr(episodeThumbnailUrl(series, episode))}" alt="" loading="lazy" />
            <div class="episode-info">
              <span class="episode-number">Episode ${escapeHtml(episode.number || index + 1)}${episode.recap ? '<span class="recap-badge">Recap</span>' : ""}${isYouTubeOnly ? '<span class="recap-badge">YouTube</span>' : available ? "" : '<span class="recap-badge muted-badge">Uploading soon</span>'}</span>
              <strong>${escapeHtml(episode.title)}</strong>
              ${meta ? `<span class="episode-date">${escapeHtml(meta)}</span>` : ""}
              ${episode.views ? `<span class="episode-views">${escapeHtml(formatViewCount(episode.views))}</span>` : ""}
              ${available ? "" : `<span class="episode-status">${escapeHtml(episode.statusNote || "Video not added yet. It will be uploaded in the future.")}</span>`}
            </div>`;
      return `          <article class="episode-card ${available ? "" : "is-unavailable"}" data-episode-index="${index}">
            ${available ? `<a class="episode-card-link"${href}${targetAttr}>${content}</a>` : content}
          </article>`;
    })
    .join("\n");
}

function renderSeriesPage(entry, series) {
  const canonical = `${ORIGIN}${seriesPath(series)}`;
  const description = summarize(series.description || entry.description, `Watch ${series.title} by ${series.speaker} on Improving Muslim.`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${series.title} | Improving Muslim`,
    url: canonical,
    description,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: "Improving Muslim",
      url: `${ORIGIN}/`,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: series.episodes.filter(isEpisodeAvailable).map((episode, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: episode.videoSrc ? `${ORIGIN}${watchPath(series, episode)}` : episode.youtubeId ? `https://www.youtube.com/watch?v=${episode.youtubeId}` : undefined,
        name: episode.number ? `Episode ${episode.number}: ${episode.title}` : episode.title,
      })),
    },
  };

  return seriesTemplate
    .replace(/  <head>[\s\S]*?  <\/head>/, renderHead({
      base: "../../",
      title: `${series.title} | Improving Muslim`,
      description,
      canonical,
      image: series.thumbnailSrc || entry.thumbnailSrc,
      jsonLd,
    }))
    .replace("<body>", `<body data-series-id="${escapeAttr(series.slug)}">`)
    .replace(/      <section class="series-hero">[\s\S]*?      <\/section>/, renderSeriesHero({ entry, series }))
    .replace('<div class="episode-list" id="episode-list"></div>', `<div class="episode-list" id="episode-list">\n${renderSeriesEpisodeCards(series)}\n        </div>`);
}

function renderMarkdownBlocks(text) {
  return plainText(text)
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join("\n");
}

function renderTakeaways(steps = []) {
  const items = steps.map((step) => `<li><span>${escapeHtml(plainText(step))}</span></li>`).join("");
  return `          <details class="takeaways-panel" id="takeaways-panel"${items ? "" : " hidden"}>
            <summary class="takeaways-toggle">Key Takeaways</summary>
            <div class="takeaways-body" id="watch-takeaways">
              <p class="takeaways-label">Actionable steps from this episode</p>
              <ol class="takeaway-list">${items}</ol>
            </div>
          </details>`;
}

function renderGrammarNotes(notes = []) {
  const cards = notes.map(({ term, arabic, definition }) => `
              <div class="grammar-card">
                <div class="grammar-card-term">
                  <span class="grammar-card-label">${escapeHtml(term)}</span>
                  ${arabic ? `<span class="grammar-card-arabic" dir="rtl">${escapeHtml(arabic)}</span>` : ""}
                </div>
                <p class="grammar-card-definition">${escapeHtml(definition)}</p>
              </div>`).join("");
  return `          <details class="grammar-notes-panel" id="grammar-notes-panel"${cards ? "" : " hidden"}>
            <summary class="grammar-notes-toggle">Grammar Notes</summary>
            <div class="grammar-notes-body" id="watch-grammar-notes">${cards}</div>
          </details>`;
}

function renderRecap(recap = "") {
  const body = renderMarkdownBlocks(recap);
  return `          <details class="recap-panel" id="recap-panel"${body ? "" : " hidden"}>
            <summary class="recap-toggle">Episode Recap</summary>
            <div class="recap-body" id="watch-recap">${body}</div>
          </details>`;
}

function renderCompactEpisodeList(series, currentEpisode) {
  return series.episodes
    .map((episode) => {
      const available = isEpisodeAvailable(episode);
      const tagName = available ? "a" : "div";
      const href = available ? ` href="${escapeAttr(watchHref(series, episode))}"` : "";
      return `          <${tagName} class="compact-episode ${episode.id === currentEpisode.id ? "is-current" : ""} ${available ? "" : "is-unavailable"}"${href}>
            <img src="${escapeAttr(episodeThumbnailUrl(series, episode))}" alt="" loading="lazy" />
            <span>
              <small>Episode ${escapeHtml(episode.number)}</small>
              <strong>${escapeHtml(episode.title)}</strong>
              ${available ? "" : "<em>Uploading soon</em>"}
            </span>
          </${tagName}>`;
    })
    .join("\n");
}

function renderWatchPage({ series, episode, standalone = false }) {
  const titleLabel = standalone ? episode.title : `Episode ${episode.number}: ${episode.title}`;
  const canonicalPath = standalone ? standaloneWatchPath(episode) : watchPath(series, episode);
  const canonical = `${ORIGIN}${canonicalPath}`;
  const thumb = standalone ? (episode.thumbnailSrc || "./public/social-preview.png") : episodeThumbnailUrl(series, episode);
  const fallbackDescription = standalone
    ? `Watch ${episode.title} by ${episode.speaker} on Improving Muslim.`
    : `Watch ${titleLabel} from ${series.title} by ${series.speaker} on Improving Muslim.`;
  const description = summarize(episode.description || fallbackDescription, fallbackDescription, 220);
  const duration = isoDuration(episode.duration);
  const videoObject = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: titleLabel,
    description,
    thumbnailUrl: [absoluteUrl(thumb)],
    uploadDate: episode.published,
    duration,
    contentUrl: episode.videoSrc,
    embedUrl: canonical,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: "Improving Muslim",
      url: `${ORIGIN}/`,
    },
  };
  Object.keys(videoObject).forEach((key) => videoObject[key] === undefined && delete videoObject[key]);

  const topic = standalone ? (episode.topic || "Standalone Video") : series.topic;
  const metaLine = `${escapeHtml(series.speaker || episode.speaker)} &middot; ${escapeHtml(topic || "Islamic lecture")} ${episode.published ? `&middot; ${escapeHtml(formatDate(episode.published))}` : ""}`;
  const bodyAttrs = standalone
    ? `data-lecture-id="${escapeAttr(episode.id)}"`
    : `data-series-slug="${escapeAttr(series.slug)}" data-video-id="${escapeAttr(episode.id)}"`;

  return watchTemplate
    .replace(/  <head>[\s\S]*?  <\/head>/, renderHead({
      base: "../../../",
      title: `${titleLabel} | Improving Muslim`,
      description,
      canonical,
      image: thumb,
      ogType: "video.other",
      videoUrl: episode.videoSrc,
      jsonLd: videoObject,
    }))
    .replace("<body>", `<body ${bodyAttrs}>`)
    .replace(/poster="[^"]*"/, `poster="${escapeAttr(thumb)}"`)
    .replace(/<source id="video-source" src="[^"]*" type="video\/mp4" \/>/, `<source id="video-source" src="${escapeAttr(episode.videoSrc || "")}" type="video/mp4" />`)
    .replace(/<track id="caption-track" kind="captions" srclang="en" label="English" default \/>/, episode.captionsSrc
      ? `<track id="caption-track" kind="captions" srclang="en" label="English" src="${escapeAttr(episode.captionsSrc)}" default />`
      : `<track id="caption-track" kind="captions" srclang="en" label="English" default />`)
    .replace('class="video-loading" id="video-loading"', 'class="video-loading is-hidden" id="video-loading"')
    .replace(/<a id="watch-kicker" href="[^"]*">Series<\/a>/, standalone
      ? '<a id="watch-kicker" href="./index.html#series" hidden>Series</a>'
      : `<a id="watch-kicker" href="${escapeAttr(seriesHref(series))}">${escapeHtml(series.title)}</a>`)
    .replace('<span id="watch-breadcrumb-ep">Episode</span>', `<span id="watch-breadcrumb-ep">${escapeHtml(standalone ? episode.title : `Episode ${episode.number}`)}</span>`)
    .replace('<h1 id="watch-title">Loading episode...</h1>', `<h1 id="watch-title">${escapeHtml(titleLabel)}</h1>`)
    .replace('<p id="watch-meta"></p>', `<p id="watch-meta">${metaLine}</p>`)
    .replace('<h2 id="playlist-title">Change of Heart</h2>', `<h2 id="playlist-title">${escapeHtml(standalone ? "More lectures" : series.title)}</h2>`)
    .replace(/          <details class="takeaways-panel" id="takeaways-panel" hidden>[\s\S]*?          <\/details>/, renderTakeaways(episode.takeaways))
    .replace(/          <details class="grammar-notes-panel" id="grammar-notes-panel" hidden>[\s\S]*?          <\/details>/, renderGrammarNotes(episode.grammarNotes))
    .replace(/          <details class="recap-panel" id="recap-panel" hidden>[\s\S]*?          <\/details>/, renderRecap(episode.recap))
    .replace('<div class="compact-episode-list" id="watch-episode-list"></div>', `<div class="compact-episode-list" id="watch-episode-list">\n${standalone ? "" : renderCompactEpisodeList(series, episode)}\n        </div>`);
}

const writes = [];

function queueWrite(relativePath, html) {
  writes.push({
    relativePath,
    html: html.replace(/\r\n/g, "\n"),
  });
}

for (const { entry, series } of seriesEntries) {
  queueWrite(`series/${series.slug}/index.html`, renderSeriesPage(entry, series));
  for (const episode of series.episodes.filter((ep) => ep.videoSrc)) {
    queueWrite(`watch/${series.slug}/${episode.id}/index.html`, renderWatchPage({ series, episode }));
  }
}

for (const lecture of standaloneLectures.filter((item) => item.videoSrc)) {
  const series = {
    title: "Standalone Lectures",
    slug: "standalone",
    speaker: lecture.speaker,
    topic: lecture.topic || "Standalone Video",
    episodes: [{ ...lecture, number: null }],
  };
  queueWrite(`watch/standalone/${lecture.id}/index.html`, renderWatchPage({ series, episode: lecture, standalone: true }));
}

let stale = 0;
for (const { relativePath, html } of writes) {
  const target = join(root, relativePath);
  const current = existsSync(target) ? readFileSync(target, "utf8").replace(/\r\n/g, "\n") : null;
  if (checkOnly) {
    if (current !== html) {
      console.error(`${relativePath} is missing or stale. Run: npm run seo-pages`);
      stale += 1;
    }
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  if (current !== html) writeFileSync(target, html);
}

if (checkOnly && stale) {
  console.error(`${stale} generated SEO page(s) are stale.`);
  process.exit(1);
}

console.log(`${checkOnly ? "Checked" : "Wrote"} ${writes.length} SEO page${writes.length === 1 ? "" : "s"}.`);
