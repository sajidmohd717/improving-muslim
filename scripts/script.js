const homeConfig = window.IMHomeConfig || {};
const API_ROOT = homeConfig.apiRoot || "https://sajidmohd717.github.io/series-api";
const CATALOG_VERSION = homeConfig.catalogVersion || "1";
const AI_SEARCH_ENDPOINT = homeConfig.aiSearchEndpoint || "";
const categories = homeConfig.categories || [{ name: "All", value: "foryou" }];

const categoryNameMap = Object.fromEntries(
  categories.filter(c => c.value !== "foryou").map(c => [c.value, c.name])
);

function entryCategories(entry) {
  return Array.isArray(entry.categories) ? entry.categories : [entry.category].filter(Boolean);
}

function topicLabel(cats) {
  if (!Array.isArray(cats) || !cats.length) return "Series";
  const names = cats.map(c => categoryNameMap[c] || c);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

function initialCategoryFromUrl() {
  const requestedCategory = new URLSearchParams(window.location.search).get("category");
  return categories.some((category) => category.value === requestedCategory) ? requestedCategory : "foryou";
}

const speakers = window.speakers || [];
const {
  escapeHtml,
  formatDuration,
  formatViewCount,
  getAllSeries,
  getStandaloneLectures,
  progressKey,
  readStudyStreak,
  readJsonStorage,
  readSavedItems,
  PROGRESS_PREFIX,
  storageKeysWithPrefix,
  writeSavedItems,
  seriesUrl,
} = window.IMUtils;
const episodeUrl = (series, episode) => window.IMUtils.episodeUrl(series, episode);
const episodeThumbnailUrl = (series, episode) => window.IMUtils.episodeThumbnailUrl(series, episode);
const standaloneLectureUrl = (lecture) => window.IMUtils.standaloneLectureUrl(lecture);
const standaloneLectureThumbnailUrl = (lecture) => window.IMUtils.standaloneLectureThumbnailUrl(lecture);
const standaloneProgressKey = (lecture) => window.IMUtils.standaloneProgressKey(lecture);

const excludedSpeakerNames = new Set(homeConfig.excludedSpeakerNames || []);
const excludedSeriesTitles = new Set(homeConfig.excludedSeriesTitles || []);

const imageMap = window.IMUtils.imageMap;

// Last-resort homepage sections when the remote feed is unreachable.
// Derived from the registry so removed series can never resurface here.
const fallbackData = (() => {
  const sections = [];
  for (const entry of (window.seriesConfig || [])) {
    const name = entry.sectionTitle || "Series";
    let section = sections.find((s) => s.sectionTitle === name);
    if (!section) {
      section = { sectionTitle: name, seriesList: [] };
      sections.push(section);
    }
    section.seriesList.push({
      title: entry.title,
      speaker: entry.speaker,
      episodes: `${entry.episodeCount} Lectures`,
      thumbnailImage: entry.thumbnailSrc,
      link: seriesUrl(entry),
    });
  }
  return sections;
})();

const localCategoryFallbacks = (() => {
  const map = {};
  for (const entry of (window.seriesConfig || [])) {
    if (!entry.title) continue;
    const cats = entryCategories(entry);
    for (const cat of cats) {
      if (!map[cat]) map[cat] = [];
      const sectionName = categoryNameMap[cat] || cat;
      let section = map[cat].find(sec => sec.sectionTitle === sectionName);
      if (!section) {
        section = { sectionTitle: sectionName, seriesList: [] };
        map[cat].push(section);
      }
      section.seriesList.push({
        title: entry.title,
        speaker: entry.speaker,
        episodes: `${entry.episodeCount} Lectures`,
        thumbnailImage: entry.thumbnailSrc,
        link: seriesUrl(entry),
      });
    }
  }
  // A category can be represented only by standalone lectures (currently
  // Aqeedah and Fiqh). Give those categories an empty local section list so
  // loadCategory treats them as first-class local filters instead of fetching
  // an unrelated remote feed before standalone cards are merged in.
  for (const lecture of (window.standaloneLectures || [])) {
    for (const cat of entryCategories(lecture)) {
      if (!map[cat]) map[cat] = [];
    }
  }
  return map;
})();

const localFirstCategories = new Set(Object.keys(localCategoryFallbacks));

const descriptions = homeConfig.descriptions || {};

const state = {
  activeCategory: initialCategoryFromUrl(),
  sections: [],
  searchTerm: "",
  sortBy: "random",
  activeSpeaker: null,
  contentType: "all",
  hideWatched: localStorage.getItem("im-hide-watched") === "true",
  aiSearch: {
    query: "",
    pending: false,
    results: null,
    reasonById: {},
    scoreById: {},
    message: "",
  },
};

function enrichSeries(item) {
  const local = availableLocalSeries().find(s => s.title === item.title);
  if (local) {
    const total = local.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  // Fuzzy match for Seerah: API may return a slightly different title spelling
  if ((item.title.includes("Seerah of Prophet") || item.title.includes("Seerah of the Prophet")) && window.seerahYasirQadhiSeries) {
    const total = window.seerahYasirQadhiSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  return item;
}

function parseViewCount(str) {
  if (!str) return -1;
  const num = parseFloat(str);
  if (/[Mm]/.test(str)) return num * 1_000_000;
  if (/[Kk]/.test(str)) return num * 1_000;
  return num || -1;
}

// Stable random sort: each title gets one random key per page load, reused
// across all category switches so the order never changes mid-session.
const randomSortKeys = new Map();
function stableRandomKey(title) {
  if (!randomSortKeys.has(title)) {
    randomSortKeys.set(title, Math.random());
  }
  return randomSortKeys.get(title);
}

function getSortedSeries(list) {
  // Default is a fresh shuffle per visit so no series is permanently
  // buried below the fold. "featured" is the curated registry order.
  if (state.sortBy === "featured") {
    return list;
  }
  if (state.sortBy === "random") {
    return [...list].sort((a, b) => stableRandomKey(a.title) - stableRandomKey(b.title));
  }
  if (state.sortBy === "views") {
    return [...list].sort((a, b) => parseViewCount(b.viewcount) - parseViewCount(a.viewcount));
  }
  if (state.sortBy === "az") {
    return [...list].sort((a, b) => a.title.localeCompare(b.title));
  }
  return list;
}

function searchSections() {
  if (!state.searchTerm) return state.sections;
  return mergeLocalSeries(state.sections, "foryou");
}

const els = {
  menuToggle: document.querySelector(".menu-toggle"),
  siteMenu: document.querySelector("#site-menu"),
  speakerList: document.querySelector("#speaker-list"),
  continueSection: document.querySelector("#continue-section"),
  continueList: document.querySelector("#continue-list"),
  streakSection: document.querySelector("#streak-section"),
  streakCard: document.querySelector("#streak-card"),
  categoryList: document.querySelector("#category-list"),
  seriesGrid: document.querySelector("#series-grid"),
  statusMessage: document.querySelector("#status-message"),
  resultCount: document.querySelector("#result-count"),
  seriesTitle: document.querySelector("#series-title"),
  searchForm: document.querySelector(".search-form"),
  searchInput: document.querySelector("#series-search"),
  searchSuggestions: document.querySelector("#search-suggestions"),
  sortTrigger: document.querySelector("#sort-trigger"),
  sortDisplay: document.querySelector("#sort-display"),
  sortOptions: document.querySelector("#sort-options"),
  contentTypeFilter: document.querySelector("#content-type-filter"),
  activeCategoryLabel: document.querySelector("#active-category-label"),
  hideWatchedBtn: document.querySelector("#hide-watched-btn"),
};

function cleanJson(text) {
  return text.replace(/^\uFEFF/, "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

function normalizeSections(sections) {
  return sections.map((section) => ({
    ...section,
    seriesList: section.seriesList.map((series) => ({
      ...series,
      contentType: series.contentType || "series",
      topic: section.sectionTitle,
      thumbnailImage: imageMap[series.thumbnailImage] || series.thumbnailImage,
    })),
  }));
}

function flattenSeries(sections) {
  return sections.flatMap((section) => section.seriesList);
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function searchCatalog() {
  return uniqueBy(
    flattenSeries(mergeLocalSeries(state.sections, "foryou")).filter(isAllowedSeries),
    searchItemId,
  );
}

function searchItemId(item) {
  return `${item.contentType || "series"}:${getSeriesUrl(item)}:${item.title}`.toLowerCase();
}

function searchTextForItem(item) {
  const parts = [
    item.title,
    item.speaker,
    item.topic,
    item.episodes,
    item.description,
    item._recap,
    item._keywords,
    item._topics,
  ];
  if (Array.isArray(item._cats)) {
    item._cats.forEach((cat) => {
      parts.push(cat);
      parts.push(categoryNameMap[cat] || "");
    });
  }
  if (item.duration) parts.push(formatDuration(item.duration));
  if (item._hasCaptions) parts.push("captions subtitles cc");
  if (item._globalKey && window[item._globalKey]) {
    (window[item._globalKey].episodes || []).slice(0, 20).forEach((episode) => {
      parts.push(episode.title);
      if (episode.recap) parts.push(episode.recap.slice(0, 500));
    });
  }
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function aiSearchPayloadItems() {
  return searchCatalog().slice(0, 80).map((item) => ({
    id: searchItemId(item),
    title: item.title || "",
    speaker: item.speaker || "",
    topic: item.topic || "",
    type: item.contentType === "video" ? "video" : "series",
    text: searchTextForItem(item).slice(0, 1800),
  }));
}

// ── Transcript search results ────────────────────────────────────────────────
// "Mentioned inside lectures": IMTranscriptSearch finds the lectures whose
// captions mention the query and the exact moments they do; each moment links
// to the watch page with a ?t= timestamp. Rendered below the catalogue results
// so title/topic matches always come first.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSnippet(snippet, matchedWords) {
  const escaped = escapeHtml(snippet);
  if (!matchedWords?.length) return escaped;
  const pattern = new RegExp(`(${matchedWords.map(escapeRegExp).join("|")})`, "gi");
  return escaped.replace(pattern, "<mark>$1</mark>");
}

function runTranscriptSearch(query) {
  const section = document.querySelector("#transcript-section");
  const list = document.querySelector("#transcript-results");
  if (!section || !list) return;
  if (!query || !window.IMTranscriptSearch) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }

  window.IMTranscriptSearch.search(query)
    .then((results) => {
      if (state.searchTerm !== query) return; // stale response for an older query
      const itemsByKey = new Map((window.catalogIndex?.items || []).map((item) => [item.key, item]));
      const cards = results
        .map((result) => ({ result, item: itemsByKey.get(result.key) }))
        .filter(({ item }) => item)
        .map(({ result, item }) => {
          const context = item.kind === "episode" ? `${item.seriesTitle} · Ep ${item.number}` : item.speaker;
          const moments = result.moments
            .map(
              (moment) => `
                <a class="transcript-moment" href="${escapeHtml(item.url)}?t=${moment.time}">
                  <span class="transcript-time">${formatDuration(moment.time)}</span>
                  <span class="transcript-snippet">${highlightSnippet(moment.snippet, moment.matchedWords)}</span>
                </a>`,
            )
            .join("");
          return `
            <article class="transcript-card">
              <a class="transcript-card-head" href="${escapeHtml(item.url)}?t=${result.moments[0].time}">
                <img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />
                <span>
                  <small>${escapeHtml(context)}</small>
                  <strong>${escapeHtml(item.title)}</strong>
                </span>
              </a>
              <div class="transcript-moments">${moments}</div>
            </article>`;
        });

      section.hidden = !cards.length;
      list.innerHTML = cards.join("");
    })
    .catch(() => {
      if (state.searchTerm !== query) return;
      section.hidden = true;
      list.innerHTML = "";
    });
}

const homeSearch = window.IMHomeSearch.create({
  els,
  escapeHtml,
  formatDuration,
  categoryNameMap,
  catalog: searchCatalog,
  onSubmit(query) {
    state.searchTerm = query;
    state.aiSearch = { query, pending: Boolean(query && AI_SEARCH_ENDPOINT), results: null, reasonById: {}, scoreById: {}, message: "" };
    renderSeries();
    runTranscriptSearch(query);
    if (query) {
      scrollToSeriesResults();
      logSearch(query);
      runAiSearch(query);
    }
  },
});

// Slugs of series registered in data/series-registry.js. Cards from the
// remote series-api that point at an unregistered series-detail id would
// dead-end in a redirect back to the browse page, so they are dropped.
const registeredSlugs = new Set((window.seriesConfig || []).map((entry) => entry.slug));

function isAllowedSeries(series) {
  const speaker = (series.speaker || "").trim().toLowerCase();
  if (excludedSpeakerNames.has(speaker)) return false;
  if (excludedSeriesTitles.has((series.title || "").trim().toLowerCase())) return false;
  const detailMatch = /series-detail\.html\?id=([a-z0-9-]+)/.exec(series.link || "");
  if (detailMatch && !registeredSlugs.has(detailMatch[1])) return false;
  return true;
}

function availableLocalSeries() {
  return getAllSeries();
}

function availableStandaloneLectures() {
  return getStandaloneLectures();
}

function localStandaloneSections(category = "foryou") {
  const sections = [];
  for (const lecture of availableStandaloneLectures()) {
    const cats = entryCategories(lecture);
    if (category !== "foryou" && !cats.includes(category)) continue;
    const card = {
      title: lecture.title,
      speaker: lecture.speaker,
      topic: topicLabel(cats),
      episodes: lecture.typeLabel || "Standalone Video",
      thumbnailImage: standaloneLectureThumbnailUrl(lecture),
      link: standaloneLectureUrl(lecture),
      description: lecture.description,
      contentType: "video",
      duration: lecture.duration,
      sourceId: lecture.id,
      _cats: cats,
      _hasCaptions: Boolean(lecture.captionsSrc),
      _recap: typeof lecture.recap === "string" ? lecture.recap.slice(0, 600) : "",
    };
    const sectionTitle = categoryNameMap[cats[0]] || cats[0] || "Standalone Videos";
    const existing = sections.find(sec => sec.sectionTitle === sectionTitle);
    if (existing) {
      existing.seriesList.push(card);
    } else {
      sections.push({ sectionTitle, seriesList: [card] });
    }
  }
  return sections;
}

function availLabel(entry) {
  const total = entry.episodeCount || 0;
  const avail = entry.availableCount ?? total;
  if (avail >= total) return { text: `${total} Lectures`, cls: "" };
  if (avail === 0) return { text: "Coming soon", cls: "avail-none" };
  return { text: `${avail} of ${total} available`, cls: "avail-partial" };
}

function availBadge(entry) {
  const total = entry.episodeCount || 0;
  const avail = typeof entry.availableCount === "number" ? entry.availableCount : total;
  if (avail === 0) return null;
  if (avail >= total) return { text: "Fully available", cls: "badge-full" };
  return { text: `${avail} of ${total} available`, cls: "badge-partial" };
}

function localSeriesSections(category = "foryou") {
  const sections = [];
  for (const entry of (window.seriesConfig || [])) {
    if (!entry.title) continue;
    const avail = entry.availableCount ?? entry.episodeCount ?? 0;
    if (avail === 0) continue; // hide zero-available series from all catalogue views
    const cats = entryCategories(entry);
    if (category === "available") {
      // already filtered by avail > 0 above — show regardless of subject category
    } else if (category !== "foryou" && !cats.includes(category)) continue;
    const { text: episodesText, cls: episodesCls } = availLabel(entry);
    const card = {
      title: entry.title,
      speaker: entry.speaker,
      topic: topicLabel(cats),
      episodes: episodesText,
      episodesCls,
      thumbnailImage: entry.thumbnailSrc,
      link: seriesUrl(entry),
      description: entry.description,
      contentType: "series",
      _globalKey: entry.globalKey,
      _keywords: entry.searchKeywords || "",
      _topics: entry.topicKeywords || "",
      _cats: cats,
      _badge: availBadge(entry),
      _label: entry.label || null,
    };
    const sectionTitle = categoryNameMap[cats[0]] || cats[0];
    const existing = sections.find(sec => sec.sectionTitle === sectionTitle);
    if (existing) {
      existing.seriesList.push(card);
    } else {
      sections.push({ sectionTitle, seriesList: [card] });
    }
  }
  return sections;
}

function mergeLocalSeries(sections, category) {
  const localCategories = new Set([
    "foryou",
    "available",
    ...(window.seriesConfig || []).flatMap(e => entryCategories(e)),
    ...availableStandaloneLectures().flatMap(lecture => entryCategories(lecture)),
  ]);
  if (!localCategories.has(category)) {
    return sections;
  }

  const localSections = [...localSeriesSections(category), ...localStandaloneSections(category)];
  const localTitles = new Set(flattenSeries(localSections).map((series) => series.title.toLowerCase()));
  // Include API alias titles for series whose API/external title differs from the local data file title
  for (const entry of (window.seriesConfig || [])) {
    if (entry.apiTitle) localTitles.add(entry.apiTitle.toLowerCase());
  }
  const merged = sections
    .map((section) => ({
      ...section,
      seriesList: section.seriesList.filter((series) => !localTitles.has(series.title.toLowerCase())),
    }))
    .filter((section) => section.seriesList.length);
  const existingTitles = new Set(flattenSeries(merged).map((series) => series.title.toLowerCase()));

  localSections.forEach((localSection) => {
    const newSeries = localSection.seriesList.filter((series) => !existingTitles.has(series.title.toLowerCase()));
    if (!newSeries.length) {
      return;
    }

    const matchingSection = merged.find((section) => section.sectionTitle === localSection.sectionTitle);
    if (matchingSection) {
      matchingSection.seriesList.push(...newSeries);
    } else {
      merged.push({ ...localSection, seriesList: newSeries });
    }
    newSeries.forEach((series) => existingTitles.add(series.title));
  });

  return merged;
}

function setStatus(message, isVisible = true) {
  els.statusMessage.innerHTML = message;
  els.statusMessage.classList.toggle("is-visible", isVisible);
}

const skelLabelW = ["38%", "43%", "35%", "41%", "37%", "44%", "36%", "42%", "39%"];
const skelTitleW = ["78%", "65%", "83%", "70%", "76%", "68%", "80%", "63%", "74%"];
const skelMetaW  = ["56%", "48%", "63%", "52%", "59%", "46%", "61%", "50%", "55%"];

function showSkeletons(count = 6) {
  setStatus("", false);
  els.seriesGrid.innerHTML = Array.from({ length: count }, (_, i) => {
    const delay = i * 90;
    return `
      <div class="series-card" aria-hidden="true">
        <div class="skel skel-thumb" style="animation-delay:${delay}ms"></div>
        <div class="series-body">
          <div class="skel skel-label" style="width:${skelLabelW[i % 9]};animation-delay:${delay}ms"></div>
          <div class="skel skel-title" style="width:${skelTitleW[i % 9]};animation-delay:${delay + 50}ms"></div>
          <div class="skel skel-meta"  style="width:${skelMetaW[i % 9]};animation-delay:${delay + 100}ms"></div>
        </div>
      </div>`;
  }).join("");
}

function savedSeriesItem(series, url) {
  return {
    key: `${series.contentType === "video" ? "video" : "series"}:${url}`,
    type: series.contentType === "video" ? "video" : "series",
    title: series.title,
    subtitle: [series.speaker, series.episodes].filter(Boolean).join(" - "),
    url,
    savedAt: Date.now(),
  };
}

function isSeriesSaved(url) {
  return readSavedItems().some((item) => item.key === `series:${url}` || item.key === `video:${url}`);
}

function seriesActionIcons() {
  return {
    save:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span class="sr-only">Save series</span>',
    share:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg><span class="sr-only">Share series</span>',
    details:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg><span class="sr-only">Show details</span>',
  };
}

function updateSeriesSaveButton(button, saved) {
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute("aria-label", saved ? "Remove saved series" : "Save series");
  const span = button.querySelector("span");
  if (span) span.textContent = saved ? "Saved" : "Save";
}

function closeCardMenu(menu) {
  if (!menu) return;
  menu.hidden = true;
  const trigger = menu.previousElementSibling;
  if (trigger?.classList.contains("card-menu-trigger")) {
    trigger.setAttribute("aria-expanded", "false");
  }
  menu.closest(".series-card")?.style.removeProperty("z-index");
}

function toggleSavedSeries(series, url, button) {
  const item = savedSeriesItem(series, url);
  const items = readSavedItems();
  const existing = items.findIndex((saved) => saved.key === item.key);
  const nextItems =
    existing >= 0
      ? items.filter((saved) => saved.key !== item.key)
      : [item, ...items.filter((saved) => saved.key !== item.key)].slice(0, 60);

  if (!writeSavedItems(nextItems)) {
    button.setAttribute("aria-label", "Could not save series");
    return;
  }

  const saved = existing < 0;
  updateSeriesSaveButton(button, saved);
}

async function shareSeries(series, url, button) {
  const absoluteUrl = new URL(url, document.baseURI).href;
  const shareData = {
    title: series.title,
    text: [series.title, series.speaker].filter(Boolean).join(" by "),
    url: absoluteUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(absoluteUrl);
    button.setAttribute("aria-label", "Series link copied");
    setTimeout(() => {
      button.setAttribute("aria-label", "Share series");
    }, 1800);
  } catch {
    button.setAttribute("aria-label", "Could not share series");
  }
}

function readStoredProgress(series, episode) {
  try {
    const progress = readJsonStorage(progressKey(series, episode), {});
    const currentTime = Number(progress.currentTime) || 0;
    const duration = Number(progress.duration) || 0;
    const percent = duration > 0 ? currentTime / duration : 0;

    if (currentTime < 10 || percent < 0.02 || percent > 0.97) {
      return null;
    }

    return {
      currentTime,
      duration,
      percent,
      updatedAt: Number(progress.updatedAt) || 0,
    };
  } catch (error) {
    return null;
  }
}

function readStoredStandaloneProgress(lecture) {
  try {
    const progress = readJsonStorage(standaloneProgressKey(lecture), {});
    const currentTime = Number(progress.currentTime) || 0;
    const duration = Number(progress.duration) || 0;
    const percent = duration > 0 ? currentTime / duration : 0;

    if (currentTime < 10 || percent < 0.02 || percent > 0.97) {
      return null;
    }

    return {
      currentTime,
      duration,
      percent,
      updatedAt: Number(progress.updatedAt) || 0,
    };
  } catch (error) {
    return null;
  }
}

function renderContinueWatching() {
  const allProgressKeys = storageKeysWithPrefix(PROGRESS_PREFIX);

  const items = allProgressKeys.map((key) => {
    try {
      const stored = readJsonStorage(key, {});
      if (!stored.updatedAt || !stored.duration) return null;
      const currentTime = Math.max(0, Number(stored.currentTime) || 0);
      const duration = Math.max(1, Number(stored.duration));
      const percent = Math.min(1, currentTime / duration);
      const progress = { currentTime, duration, percent, updatedAt: Number(stored.updatedAt) || 0 };

      if (stored._card) {
        return { progress, key, ...stored._card };
      }

      // Fallback for legacy standalone saves that predate _card
      if (key.includes(":standalone:")) {
        const lectureId = key.split(":standalone:")[1];
        const lecture = availableStandaloneLectures().find((l) => l.id === lectureId);
        if (!lecture || !lecture.videoSrc) return null;
        return {
          progress,
          key,
          eyebrow: `${lecture.speaker} - Standalone video`,
          title: lecture.title,
          thumbnail: standaloneLectureThumbnailUrl(lecture),
          url: standaloneLectureUrl(lecture),
        };
      }

      return null;
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => b.progress.updatedAt - a.progress.updatedAt)
  .slice(0, 4);

  if (!els.continueSection || !els.continueList) {
    return;
  }

  // New visitors see the catalogue first; the section only appears once
  // there is something to resume.
  if (!items.length) {
    els.continueSection.hidden = true;
    els.continueList.innerHTML = "";
    return;
  }
  els.continueSection.hidden = false;

  const removeButton = `
    <button class="continue-remove" type="button" aria-label="Remove from watch history">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;

  const [heroItem, ...restItems] = items;
  const heroPercent = Math.round(heroItem.progress.percent * 100);
  const heroMinutesLeft = Math.max(1, Math.round((heroItem.progress.duration - heroItem.progress.currentTime) / 60));
  const heroCard = `
    <div class="continue-card continue-hero reveal-anim" data-progress-key="${escapeHtml(heroItem.key)}">
      <a class="continue-card-link" href="${heroItem.url}">
        <div class="continue-thumb">
          <img src="${heroItem.thumbnail}" alt="" />
          <div class="continue-bar" role="img" aria-label="${heroPercent}% watched">
            <span style="width:${heroPercent}%"></span>
          </div>
        </div>
        <div class="continue-body">
          <small>${escapeHtml(heroItem.eyebrow)}</small>
          <strong>${escapeHtml(heroItem.title)}</strong>
          <em>Resume at ${formatDuration(heroItem.progress.currentTime)} · ${heroMinutesLeft} min left</em>
          <span class="continue-resume-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            Resume
          </span>
        </div>
      </a>
      ${removeButton}
    </div>
  `;

  const compactCards = restItems
    .map((item, i) => {
      const { progress, key } = item;
      const percent = Math.round(progress.percent * 100);
      return `
        <div class="continue-card reveal-anim" style="--reveal-delay:${(i + 1) * 50}ms" data-progress-key="${escapeHtml(key)}">
          <a class="continue-card-link" href="${item.url}">
            <div class="continue-thumb">
              <img src="${item.thumbnail}" alt="" loading="lazy" />
              <div class="continue-ring" role="img" aria-label="${percent}% watched">
                <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
                  <circle class="ring-track" cx="18" cy="18" r="15.9"/>
                  <circle class="ring-fill" cx="18" cy="18" r="15.9"
                    stroke-dasharray="${percent} 100"
                    stroke-dashoffset="25"/>
                </svg>
              </div>
            </div>
            <div class="continue-body">
              <small>${escapeHtml(item.eyebrow)}</small>
              <strong>${escapeHtml(item.title)}</strong>
              <em>Resume at ${formatDuration(progress.currentTime)}</em>
            </div>
          </a>
          ${removeButton}
        </div>
      `;
    })
    .join("");

  els.continueList.innerHTML = heroCard + compactCards;
}

// ── "Because you watched" shelves ────────────────────────────────────────────
// Personalized rows seeded from the most recent meaningfully-watched lectures
// (completed, or 2+ minutes in), ranked catalog-wide by IMRelated. Hidden for
// new visitors with no history, and capped at two shelves so the catalogue
// stays the page's centre of gravity.
function catalogProgress(item) {
  return readJsonStorage(`${PROGRESS_PREFIX}${item.playlistId}:${item.id}`, {});
}

// Shared card markup for the horizontal shelf rows ("Because you watched",
// "Popular right now"). metaText is the small line under the title.
function shelfCardHtml(item, metaText) {
  const context = item.kind === "episode" ? `${item.seriesTitle} · Ep ${item.number}` : item.speaker;
  return `
    <a class="shelf-card" href="${escapeHtml(item.url)}">
      <img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />
      <span class="shelf-card-body">
        <small>${escapeHtml(context)}</small>
        <strong>${escapeHtml(item.title)}</strong>
        ${metaText ? `<em>${escapeHtml(metaText)}</em>` : ""}
      </span>
    </a>`;
}

// "Popular right now": anonymous play counts from the popularity Worker,
// shown to everyone — it is the one personalization-free shelf, so brand-new
// visitors get social proof even with no watch history. Hidden until the
// Worker is deployed and enough plays accumulate.
function renderPopularShelf() {
  const section = document.querySelector("#popular-section");
  const list = document.querySelector("#popular-list");
  if (!section || !list || !window.IMPopularity) return;
  const catalogItems = window.catalogIndex?.items || [];
  if (!catalogItems.length) return;

  window.IMPopularity.refreshCounts().then((counts) => {
    const ranked = catalogItems
      .map((item) => ({ item, plays: counts[item.key]?.p || 0 }))
      .filter(({ plays }) => plays >= 2)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 8);

    // A "popular" shelf with one or two entries reads as noise, not signal.
    if (ranked.length < 4) {
      section.hidden = true;
      list.innerHTML = "";
      return;
    }

    list.innerHTML = ranked
      .map(({ item, plays }) => {
        const mins = item.duration ? `${Math.round(item.duration / 60)} min` : "";
        return shelfCardHtml(item, [`${plays} plays`, mins].filter(Boolean).join(" · "));
      })
      .join("");
    section.hidden = false;
  });
}

function renderRecommendationShelves() {
  const host = document.querySelector("#recommendation-shelves");
  if (!host) return;
  const catalogItems = window.catalogIndex?.items || [];
  if (!window.IMRelated || !catalogItems.length) {
    host.innerHTML = "";
    return;
  }

  const itemByProgressKey = new Map(
    catalogItems.map((item) => [`${PROGRESS_PREFIX}${item.playlistId}:${item.id}`, item]),
  );

  const seeds = storageKeysWithPrefix(PROGRESS_PREFIX)
    .map((key) => {
      try {
        const stored = readJsonStorage(key, {});
        const item = itemByProgressKey.get(key);
        if (!item || !stored.updatedAt) return null;
        const engaged = stored.completed || (Number(stored.currentTime) || 0) >= 120;
        return engaged ? { item, updatedAt: Number(stored.updatedAt) || 0 } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const isWatched = (item) => Boolean(catalogProgress(item).completed);
  const alreadyPicked = new Set();
  const usedSeedGroups = new Set();
  const shelves = [];

  for (const seed of seeds) {
    if (shelves.length >= 2) break;
    // One shelf per series (or per standalone lecture) keeps the two rows varied.
    const seedGroup = seed.item.series || `standalone:${seed.item.id}`;
    if (usedSeedGroups.has(seedGroup)) continue;

    const picks = window.IMRelated
      .rankRelated({
        items: catalogItems,
        currentKey: seed.item.key,
        isWatched,
        popularity: window.IMPopularity ? window.IMPopularity.cachedCounts() : {},
        limit: 12,
      })
      .filter((item) => {
        if (alreadyPicked.has(item.key)) return false;
        // Started-but-unfinished lectures already live in the continue strip.
        const stored = catalogProgress(item);
        return !((Number(stored.currentTime) || 0) >= 10 && !stored.completed);
      })
      .slice(0, 8);
    if (picks.length < 3) continue;

    usedSeedGroups.add(seedGroup);
    picks.forEach((item) => alreadyPicked.add(item.key));
    shelves.push({ seed: seed.item, picks });
  }

  host.innerHTML = shelves
    .map(({ seed, picks }, shelfIndex) => {
      const headingId = `shelf-title-${shelfIndex}`;
      const cards = picks
        .map((item) => {
          const mins = item.duration ? `${Math.round(item.duration / 60)} min` : "";
          const meta = [item.kind === "episode" ? item.speaker : "", isWatched(item) ? "Watched" : mins]
            .filter(Boolean)
            .join(" · ");
          return shelfCardHtml(item, meta);
        })
        .join("");
      return `
        <section class="content-section shelf-section" aria-labelledby="${headingId}">
          <div class="section-heading">
            <p class="eyebrow">Because you watched</p>
            <h2 id="${headingId}">${escapeHtml(seed.title)}</h2>
          </div>
          <div class="shelf-strip">${cards}</div>
        </section>`;
    })
    .join("");
}

function renderStudyStreak() {
  if (!els.streakSection || !els.streakCard || !readStudyStreak) {
    return;
  }

  const streak = readStudyStreak();
  const targetSeconds = streak.targetMinutes * 60;
  const todaySeconds = Math.min(streak.todaySeconds, targetSeconds);
  const percent = targetSeconds > 0 ? Math.min(100, Math.round((todaySeconds / targetSeconds) * 100)) : 0;
  const watchedMinutes = Math.floor(todaySeconds / 60);
  const minutesLeft = Math.max(0, Math.ceil((targetSeconds - todaySeconds) / 60));
  const hasStarted = streak.current > 0 || streak.best > 0 || streak.todaySeconds > 0;

  if (!hasStarted) {
    els.streakSection.hidden = true;
    els.streakCard.innerHTML = "";
    return;
  }

  const isComplete = todaySeconds >= targetSeconds;
  const streakLabel = `${streak.current} day${streak.current === 1 ? "" : "s"}`;
  const progressText = isComplete ? "Daily goal complete" : `${minutesLeft} min left today`;
  const continueHref = document.querySelector(".continue-card-link")?.getAttribute("href") || "./index.html#series";

  els.streakSection.hidden = false;
  els.streakCard.innerHTML = `
    <div class="streak-orb" style="--streak-progress:${percent}%">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2s4 4.4 4 8a4 4 0 0 1-8 0c0-1.9 1.1-3.4 2.2-4.7"/>
        <path d="M6.6 10.8A7 7 0 1 0 18 8c.4 1.8-.1 3.4-1.1 4.5"/>
      </svg>
      <strong>${streak.current}</strong>
    </div>
    <div class="streak-copy">
      <small>Daily learning streak</small>
      <h2 id="streak-title">${isComplete ? `${streakLabel} strong` : `${streakLabel} in progress`}</h2>
      <p>${watchedMinutes} of ${streak.targetMinutes} minutes watched today. ${escapeHtml(progressText)}.</p>
      <div class="streak-track" aria-label="${percent}% of today's learning goal complete">
        <span style="width:${percent}%"></span>
      </div>
    </div>
    <div class="streak-stats">
      <span><strong>${streak.best}</strong><small>Best</small></span>
      <a class="streak-action" href="${continueHref}">${isComplete ? "Keep learning" : "Continue"}</a>
    </div>
  `;
}

function renderSpeakers() {
  if (!els.speakerList) return;
  els.speakerList.innerHTML = speakers
    .map(
      (speaker, i) => `
        <a class="speaker-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 40}ms" href="./pages/speaker.html?speaker=${encodeURIComponent(speaker.slug)}">
          <img src="${speaker.image}" alt="${escapeHtml(speaker.name)}" loading="lazy" />
          <span>${escapeHtml(speaker.name)}</span>
        </a>
      `,
    )
    .join("");
}

function renderCategories() {
  els.categoryList.innerHTML = categories
    .map(
      (category) => `
        <button
          class="category-button ${category.value === state.activeCategory ? "is-active" : ""}"
          type="button"
          data-category="${category.value}"
        >
          ${escapeHtml(category.name)}
        </button>
      `,
    )
    .join("");
}

function seriesMatchesSearch(series) {
  return homeSearch.matchesSeries(series, state.searchTerm);
}

function seriesMatchesContentType(series) {
  if (state.contentType === "all") return true;
  if (state.contentType === "videos") return series.contentType === "video";
  return series.contentType !== "video";
}

function seriesMatchesSpeaker(series) {
  if (!state.activeSpeaker) return true;
  return series.speaker === state.activeSpeaker;
}

function isItemWatched(item) {
  if (item.contentType === "video") {
    if (!item.sourceId) return false;
    const stored = readJsonStorage(`${PROGRESS_PREFIX}standalone:${item.sourceId}`, {});
    return Boolean(stored.completed);
  }
  const summary = seriesProgressSummary(item.title);
  return Boolean(summary && summary.completed >= summary.total);
}

function standaloneVideoProgress(sourceId) {
  if (!sourceId) return null;
  const stored = readJsonStorage(`${PROGRESS_PREFIX}standalone:${sourceId}`, {});
  const currentTime = Number(stored.currentTime) || 0;
  const duration = Number(stored.duration) || 0;
  if (!duration || currentTime < 10) return null;
  const pct = Math.min(1, currentTime / duration);
  if (pct > 0.97) return null; // completed — don't clutter the card
  return pct;
}

function seriesProgressSummary(seriesTitle) {
  const localSeries = availableLocalSeries().find((s) => s.title === seriesTitle);
  if (!localSeries) return null;
  const watchable = localSeries.episodes.filter((e) => e.videoSrc);
  if (!watchable.length) return null;
  let completed = 0;
  let started = false;
  for (const ep of watchable) {
    const p = readJsonStorage(progressKey(localSeries, ep), {});
    if (p.completed) { completed++; started = true; }
    else if (p.currentTime > 10) { started = true; }
  }
  if (!started) return null;
  return { completed, total: watchable.length };
}

function getSeriesUrl(series) {
  if (series.contentType === "video") return series.link;
  const local = availableLocalSeries().find(s => s.title === series.title);
  if (local) return seriesUrl(local);
  return series.link;
}

function renderSeries() {
  const isSearching = Boolean(state.searchTerm);
  const aiIds = state.aiSearch.query === state.searchTerm && Array.isArray(state.aiSearch.results)
    ? state.aiSearch.results
    : null;
  const aiOrder = new Map((aiIds || []).map((id, index) => [id, index]));
  const searchScores = new Map();
  const strongIds = new Set();
  let series = flattenSeries(searchSections())
    .filter(isAllowedSeries)
    .filter((item) => {
      if (!isSearching) return true;
      const id = searchItemId(item);
      const match = homeSearch.assessSeries(item, state.searchTerm);
      if (match.score > 0) searchScores.set(id, match.score);
      if (match.strong) strongIds.add(id);
      // AI ranking augments the keyword results, it must not shrink them:
      // strong keyword matches stay even when the AI ranker omits them.
      if (aiIds) return aiOrder.has(id) || match.strong;
      return match.score > 0;
    })
    .filter(seriesMatchesSpeaker)
    .filter(seriesMatchesContentType)
    .filter((item) => !state.hideWatched || !isItemWatched(item))
    .map(enrichSeries);
  series = aiIds
    ? series.sort((a, b) => {
        const rankA = aiOrder.has(searchItemId(a)) ? aiOrder.get(searchItemId(a)) : Infinity;
        const rankB = aiOrder.has(searchItemId(b)) ? aiOrder.get(searchItemId(b)) : Infinity;
        if (rankA !== rankB) return rankA - rankB;
        return (searchScores.get(searchItemId(b)) || 0) - (searchScores.get(searchItemId(a)) || 0);
      })
    : isSearching && state.sortBy === "random"
    ? [...series].sort((a, b) => (searchScores.get(searchItemId(b)) || 0) - (searchScores.get(searchItemId(a)) || 0))
    : getSortedSeries(series);

  // Items that only matched buried text (recaps, keyword lists) are shown
  // under a "possibly related" divider instead of posing as real results.
  // Once AI scores arrive, the same applies to AI-ranked items that score
  // well below the AI's best match: they trail as "related" too.
  let related = [];
  if (isSearching) {
    const aiScores = state.aiSearch.scoreById || {};
    const topAiScore = aiIds ? Math.max(0, ...aiIds.map((id) => aiScores[id] || 0)) : 0;
    const isTopResult = (item) => {
      const id = searchItemId(item);
      if (strongIds.has(id)) return true;
      if (!aiIds || !aiOrder.has(id)) return false;
      return topAiScore <= 0 || (aiScores[id] || 0) >= topAiScore * 0.6;
    };
    related = series.filter((item) => !isTopResult(item));
    series = series.filter(isTopResult);
  }
  const categoryName = categories.find((category) => category.value === state.activeCategory)?.name || "For You";

  document.body.classList.toggle("search-mode", isSearching);
  els.activeCategoryLabel.textContent = state.activeSpeaker
    ? state.activeSpeaker
    : isSearching
    ? "Search"
    : categoryName;
  if (els.seriesTitle) {
    els.seriesTitle.textContent = isSearching
      ? `Search results for "${state.searchTerm}"`
      : "Lecture Series";
  }
  const aiPending = state.aiSearch.pending && state.aiSearch.query === state.searchTerm;
  const videoCount = series.filter((item) => item.contentType === "video").length;
  const seriesCount = series.length - videoCount;
  const breakdownParts = [];
  if (seriesCount) breakdownParts.push(`${seriesCount} series`);
  if (videoCount) breakdownParts.push(`${videoCount} ${videoCount === 1 ? "video" : "videos"}`);
  const breakdown = breakdownParts.join(" · ") || (related.length ? "No exact matches" : "0 results");
  const relatedNote = related.length ? ` · ${related.length} related` : "";
  els.resultCount.innerHTML = aiPending
    ? `<span class="ai-search-spinner" aria-hidden="true"></span>Searching with AI… ${breakdown}${relatedNote} so far`
    : `${breakdown}${relatedNote}${aiIds ? " · ranked by AI" : ""}`;

  if (!series.length && !related.length) {
    els.seriesGrid.innerHTML = "";
    if (aiPending) {
      setStatus(
        `<span class="ai-search-spinner" aria-hidden="true"></span> No instant matches for "${escapeHtml(state.searchTerm)}" — AI is searching descriptions and topics. This can take a few seconds…`
      );
      return;
    }
    const aiEmptyMessage = state.aiSearch.query === state.searchTerm ? state.aiSearch.message : "";
    setStatus(
      state.searchTerm
        ? aiEmptyMessage
          ? `${escapeHtml(aiEmptyMessage)} In the meantime, <a href="./pages/explore.html">browse by topic on Explore</a>.`
          : `We don't have lectures on "${escapeHtml(state.searchTerm)}" just yet — but we're adding new topics regularly, and your search helps us decide what to upload next. In the meantime, <a href="./pages/explore.html">browse by topic on Explore</a>.`
        : 'No lectures in this category yet. <a href="./pages/explore.html">Browse by topic on Explore</a> or check back soon.'
    );
    return;
  }

  setStatus("", false);
  const seriesCardHtml = (item, i) => {
      const seriesUrl = getSeriesUrl(item);
      const isVideo = item.contentType === "video";
      const description =
        item.description ||
        descriptions[item.title] ||
        "Open the playlist to explore the complete lecture series on YouTube.";
      const seriesProgress = isVideo ? null : seriesProgressSummary(item.title);
      const videoProgress = isVideo ? standaloneVideoProgress(item.sourceId) : null;
      const saved = isSeriesSaved(seriesUrl);
      const progressBarHtml = seriesProgress
        ? `<div class="series-progress-track" aria-label="${seriesProgress.completed} of ${seriesProgress.total} episodes watched"><div class="series-progress-fill" style="width:${Math.round(seriesProgress.completed / seriesProgress.total * 100)}%"></div></div>`
        : videoProgress !== null
        ? `<div class="series-progress-track" aria-label="${Math.round(videoProgress * 100)}% watched"><div class="series-progress-fill" style="width:${Math.round(videoProgress * 100)}%"></div></div>`
        : "";
      return `
        <article class="series-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 50}ms">
          <a class="series-link" href="${seriesUrl}">
            <img src="${item.thumbnailImage}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.onerror=null;this.src='./public/social-preview.png';" />
          </a>
          <div class="series-body">
            <span class="series-topic">${escapeHtml(item.topic || "Series")}</span>
            <a class="series-title" href="${seriesUrl}">
              ${escapeHtml(item.title)}
            </a>
            <div class="series-meta">
              <span>${escapeHtml(item.speaker || "Speaker TBA")}</span>
              ${item.viewcount ? `<span>${escapeHtml(item.viewcount)}</span>` : ""}
            </div>
            ${item._label ? `<span class="label-badge label-${item._label.toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(item._label)}</span>` : ""}
            ${state.aiSearch.reasonById[searchItemId(item)] ? `<span class="label-badge label-ai">AI match</span>` : ""}
            ${item._badge
              ? `<span class="avail-badge ${item._badge.cls}">${escapeHtml(item._badge.text)}</span>`
              : item.episodes ? `<span class="avail-badge-plain ${item.episodesCls || ''}">${escapeHtml(item.episodes)}</span>` : ""
            }
            ${progressBarHtml}
            <button class="card-menu-trigger" type="button" aria-label="More options" aria-expanded="false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg>
            </button>
            <div class="card-menu" hidden>
              <button class="card-menu-item save-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-pressed="${saved}" aria-label="${saved ? "Remove saved item" : `Save ${isVideo ? "video" : "series"}`}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>${saved ? "Saved" : "Save"}</span>
              </button>
              <button class="card-menu-item share-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-label="Share ${isVideo ? "video" : "series"}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <span>Share</span>
              </button>
            </div>
          </div>
        </article>
      `;
  };
  const relatedDivider = related.length
    ? `<div class="related-divider" role="separator">${
        series.length
          ? "Not exact matches — possibly related"
          : `No exact matches for "${escapeHtml(state.searchTerm)}" — but these touch on it`
      }</div>`
    : "";
  els.seriesGrid.innerHTML =
    series.map(seriesCardHtml).join("") +
    relatedDivider +
    related.map((item, i) => seriesCardHtml(item, series.length + i)).join("");
}

function scrollToSeriesResults() {
  const target = document.querySelector("#series");
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function logSearch(query) {
  if (!query || !window.IMAuth || typeof window.IMAuth.logSearch !== "function") return;
  window.IMAuth.logSearch({
    query,
    resultCount: document.querySelectorAll(".series-card").length,
    contentType: state.contentType,
    category: state.activeCategory,
  });
}

async function runAiSearch(query) {
  if (!AI_SEARCH_ENDPOINT || !query) return;
  const requestQuery = query;
  try {
    const response = await fetch(AI_SEARCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        items: aiSearchPayloadItems(),
      }),
    });
    if (!response.ok) throw new Error(`AI search failed (${response.status})`);
    const data = await response.json();
    if (state.searchTerm !== requestQuery) return;
    const results = Array.isArray(data.results) ? data.results : [];
    const validIds = new Set(searchCatalog().map(searchItemId));
    const reasonById = {};
    const scoreById = {};
    const ids = [];
    results.forEach((result) => {
      const id = String(result.id || "").toLowerCase();
      if (!validIds.has(id) || ids.includes(id)) return;
      ids.push(id);
      scoreById[id] = Number(result.score) || 0;
      if (result.reason) reasonById[id] = String(result.reason).slice(0, 180);
    });
    const message = String(data.message || "").replace(/\s+/g, " ").trim().slice(0, 240);
    state.aiSearch = ids.length
      ? { query, pending: false, results: ids, reasonById, scoreById, message: "" }
      : { query, pending: false, results: null, reasonById: {}, scoreById: {}, message };
  } catch (error) {
    console.warn("[HomeSearch] AI search unavailable:", error.message);
    if (state.searchTerm === requestQuery) {
      state.aiSearch = { query, pending: false, results: null, reasonById: {}, scoreById: {}, message: "" };
    }
  }
  renderSeries();
}

async function loadCategory(category) {
  state.activeCategory = category;
  state.searchTerm = "";
  state.aiSearch = { query: "", pending: false, results: null, reasonById: {}, scoreById: {}, message: "" };
  homeSearch.reset();
  runTranscriptSearch("");
  renderCategories();
  showSkeletons(6);

  if (localFirstCategories.has(category)) {
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category]), category);
    renderSeries();
    return;
  }

  try {
    const response = await fetch(
      `${API_ROOT}/${category}-data.json?v=${encodeURIComponent(CATALOG_VERSION)}`,
    );
    if (!response.ok) {
      throw new Error(`Could not load ${category}`);
    }

    const rawText = await response.text();
    state.sections = mergeLocalSeries(normalizeSections(JSON.parse(cleanJson(rawText))), category);
  } catch (error) {
    console.warn(error);
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category] || fallbackData), category);
    setStatus(
      `Live data could not be loaded, so a saved starter collection is shown. <button class="retry-button" type="button">Retry</button>`,
    );
  }

  renderSeries();
}

function bindEvents() {
  if (els.menuToggle) {
    els.menuToggle.addEventListener("click", () => {
      const isOpen = els.siteMenu.classList.toggle("is-open");
      document.body.classList.toggle("menu-open", isOpen);
      els.menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    els.siteMenu.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        els.siteMenu.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        els.menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  els.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }
    state.activeSpeaker = null;
    loadCategory(button.dataset.category);
  });

  els.contentTypeFilter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-content-type]");
    if (!button) return;
    state.contentType = button.dataset.contentType;
    els.contentTypeFilter.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderSeries();
  });

  function syncHideWatchedBtn() {
    if (!els.hideWatchedBtn) return;
    els.hideWatchedBtn.setAttribute("aria-pressed", String(state.hideWatched));
    els.hideWatchedBtn.classList.toggle("is-active", state.hideWatched);
    els.hideWatchedBtn.querySelector("span").textContent = state.hideWatched ? "Show watched" : "Hide watched";
  }

  els.hideWatchedBtn?.addEventListener("click", () => {
    state.hideWatched = !state.hideWatched;
    localStorage.setItem("im-hide-watched", state.hideWatched);
    syncHideWatchedBtn();
    renderSeries();
  });

  syncHideWatchedBtn();

  els.seriesGrid.addEventListener("click", (event) => {
    const menuTrigger = event.target.closest(".card-menu-trigger");
    if (menuTrigger) {
      const menu = menuTrigger.nextElementSibling;
      document.querySelectorAll(".card-menu:not([hidden])").forEach((m) => {
        if (m !== menu) closeCardMenu(m);
      });
      const opening = menu.hidden;
      menu.hidden = !opening;
      menuTrigger.setAttribute("aria-expanded", String(opening));
      menuTrigger.closest(".series-card").style.zIndex = opening ? "10" : "";
      return;
    }

    const saveButton = event.target.closest(".save-series-button");
    if (saveButton) {
      const card = saveButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(searchSections()).find((series) => series.title === title);
      if (item) toggleSavedSeries(item, saveButton.dataset.seriesUrl, saveButton);
      closeCardMenu(saveButton.closest(".card-menu"));
      return;
    }

    const shareButton = event.target.closest(".share-series-button");
    if (shareButton) {
      const card = shareButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(searchSections()).find((series) => series.title === title);
      if (item) shareSeries(item, shareButton.dataset.seriesUrl, shareButton);
      closeCardMenu(shareButton.closest(".card-menu"));
      return;
    }

  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".series-card")) {
      document.querySelectorAll(".card-menu:not([hidden])").forEach(closeCardMenu);
    }
  });

  homeSearch.init();

  els.statusMessage.addEventListener("click", (event) => {
    if (event.target.matches(".retry-button")) {
      loadCategory(state.activeCategory);
    }
  });

  const sortLabels = { random: "Default", featured: "Featured order", views: "Most viewed", az: "A–Z" };

  els.sortTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !els.sortOptions.hidden;
    els.sortOptions.hidden = isOpen;
    els.sortTrigger.setAttribute("aria-expanded", String(!isOpen));
  });

  els.sortOptions?.addEventListener("click", (e) => {
    const option = e.target.closest(".sort-option");
    if (!option) return;
    const value = option.dataset.value;
    state.sortBy = value;
    els.sortDisplay.textContent = sortLabels[value] || value;
    els.sortOptions.querySelectorAll(".sort-option").forEach((o) => {
      o.classList.toggle("is-selected", o === option);
      o.setAttribute("aria-selected", String(o === option));
    });
    els.sortOptions.hidden = true;
    els.sortTrigger.setAttribute("aria-expanded", "false");
    renderSeries();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#sort-dropdown")) {
      if (els.sortOptions) els.sortOptions.hidden = true;
      els.sortTrigger?.setAttribute("aria-expanded", "false");
    }
  });
}

renderSpeakers();
renderCategories();
renderContinueWatching();
renderRecommendationShelves();
renderPopularShelf();
renderStudyStreak();
bindEvents();
loadCategory(state.activeCategory);

els.continueList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".continue-remove");
  if (!btn) return;
  const card = btn.closest("[data-progress-key]");
  if (!card) return;
  try { localStorage.removeItem(card.dataset.progressKey); } catch {}
  renderContinueWatching();
  renderRecommendationShelves();
  renderStudyStreak();
});

window.addEventListener("im-auth-state-changed", () => {
  renderContinueWatching();
  renderRecommendationShelves();
  renderStudyStreak();
  renderSeries();
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        sectionObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.06, rootMargin: "0px 0px -32px 0px" },
);

document.querySelectorAll("[data-reveal]").forEach((el) => {
  if (el.getBoundingClientRect().top > window.innerHeight) {
    el.classList.add("section-reveal");
    sectionObserver.observe(el);
  }
});
