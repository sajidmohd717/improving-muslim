const categoryParams = new URLSearchParams(window.location.search);
const categorySlug = categoryParams.get("category") || "";
const categoryTopics = (window.IMCategoryTaxonomy?.topics || []).filter((topic) => topic.public);
const categoryTopic = categoryTopics.find((topic) => topic.value === categorySlug);
const { escapeHtml, formatDuration, seriesUrl, standaloneLectureThumbnailUrl, standaloneLectureUrl } = window.IMUtils;

const categoryEls = {
  title: document.querySelector("title"),
  canonical: document.querySelector('link[rel="canonical"]'),
  heading: document.querySelector("#category-title"),
  description: document.querySelector("#category-description"),
  summary: document.querySelector("#category-summary"),
  status: document.querySelector("#category-status"),
  seriesSection: document.querySelector("#category-series-section"),
  seriesCount: document.querySelector("#category-series-count"),
  seriesGrid: document.querySelector("#category-series-grid"),
  lecturesSection: document.querySelector("#category-lectures-section"),
  lecturesCount: document.querySelector("#category-lectures-count"),
  lecturesGrid: document.querySelector("#category-lectures-grid"),
};

function categoryValues(entry) {
  return Array.isArray(entry?.categories) ? entry.categories : [entry?.category].filter(Boolean);
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function setCategoryMetadata(topic) {
  const title = `${topic.name} Lectures | Improving Muslim`;
  const description = `${topic.description} Browse focused ${topic.name.toLowerCase()} lectures and series.`;
  const canonical = `https://improvingmuslim.com/pages/category.html?category=${encodeURIComponent(topic.value)}`;
  categoryEls.title.textContent = title;
  categoryEls.canonical.href = canonical;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", description);
}

function contentCard({ title, speaker, label, thumbnail, href, durationSeconds, episodeCount }) {
  const thumbnailMeta = durationSeconds
    ? formatDuration(durationSeconds)
    : episodeCount
    ? plural(episodeCount, "Episode")
    : "";
  return `
    <article class="series-card category-content-card">
      <a class="series-link" href="${href}">
        <img src="${thumbnail}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.onerror=null;this.src='./public/social-preview.png';" />
        ${thumbnailMeta ? `<span class="thumb-duration">${thumbnailMeta}</span>` : ""}
      </a>
      <div class="series-body">
        <span class="series-topic">${escapeHtml(label)}</span>
        <a class="series-title" href="${href}">${escapeHtml(title)}</a>
        <div class="series-meta">
          <span>${escapeHtml(speaker)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryPage() {
  if (!categoryTopic) {
    categoryEls.heading.textContent = "Topic not found";
    categoryEls.description.textContent = "Choose a topic from Explore to open its focused library.";
    categoryEls.summary.textContent = "";
    categoryEls.status.textContent = "This topic does not exist in the public category list.";
    categoryEls.status.classList.add("is-visible");
    return;
  }

  setCategoryMetadata(categoryTopic);
  categoryEls.heading.textContent = categoryTopic.name;
  categoryEls.description.textContent = categoryTopic.description;

  const series = (window.seriesConfig || []).filter(
    (entry) => categoryValues(entry).includes(categorySlug) && Number(entry.availableCount) > 0,
  );
  const lectures = (window.standaloneLectures || [])
    .filter((lecture) => lecture.videoSrc && categoryValues(lecture).includes(categorySlug))
    .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")) || a.title.localeCompare(b.title));
  const episodeCount = series.reduce((total, entry) => total + Number(entry.availableCount || 0), 0);
  const watchableCount = episodeCount + lectures.length;

  categoryEls.summary.textContent = watchableCount
    ? `${plural(watchableCount, "lecture")} available${series.length ? ` across ${plural(series.length, "series", "series")}` : ""}`
    : "New lectures will be added here as the library grows.";

  if (series.length) {
    categoryEls.seriesSection.hidden = false;
    categoryEls.seriesCount.textContent = plural(series.length, "series", "series");
    categoryEls.seriesGrid.innerHTML = series.map((entry) => contentCard({
      title: entry.title,
      speaker: entry.speaker,
      label: "Series",
      episodeCount: Number(entry.episodeCount),
      thumbnail: entry.thumbnailSrc || "./public/social-preview.png",
      href: seriesUrl(entry),
    })).join("");
  }

  if (lectures.length) {
    categoryEls.lecturesSection.hidden = false;
    categoryEls.lecturesCount.textContent = plural(lectures.length, "lecture");
    categoryEls.lecturesGrid.innerHTML = lectures.map((lecture) => contentCard({
      title: lecture.title,
      speaker: lecture.speaker,
      label: "Lecture",
      durationSeconds: lecture.duration,
      thumbnail: standaloneLectureThumbnailUrl(lecture),
      href: standaloneLectureUrl(lecture),
    })).join("");
  }

  if (!watchableCount) {
    categoryEls.status.textContent = "There is no watchable content in this topic yet.";
    categoryEls.status.classList.add("is-visible");
  }
}

renderCategoryPage();
