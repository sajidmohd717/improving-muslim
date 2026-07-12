const topics = (window.IMCategoryTaxonomy?.topics || []).filter((topic) => topic.public);

const paths = [
  {
    title: "I want to feel closer to Allah",
    description: "Start with prayer, dhikr, and purification of the heart.",
    href: "./index.html?category=prayer#series",
  },
  {
    title: "I want to understand the Quran",
    description: "Begin with Quran-focused series and reflection lectures.",
    href: "./index.html?category=quran#series",
  },
  {
    title: "I want to learn the Prophet's story",
    description: "Go into seerah and build context around revelation.",
    href: "./index.html?category=seerah#series",
  },
  {
    title: "I want practical daily worship",
    description: "Browse dua, dhikr, salah, and worship habits.",
    href: "./index.html?category=dhikr#series",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countsForTopic(value) {
  const cats = (e) => Array.isArray(e.categories) ? e.categories : [e.category].filter(Boolean);
  const matchingSeries = (window.seriesConfig || []).filter((series) => cats(series).includes(value));
  const seriesCount = matchingSeries.length;
  const availableEpisodeCount = matchingSeries.reduce(
    (total, series) => total + Math.max(0, Number(series.availableCount) || 0),
    0,
  );
  const standaloneCount = (window.standaloneLectures || []).filter(
    (lecture) => lecture.videoSrc && cats(lecture).includes(value),
  ).length;
  return {
    seriesCount,
    availableEpisodeCount,
    standaloneCount,
    totalWatchable: availableEpisodeCount + standaloneCount,
  };
}

function countLabel({ seriesCount, availableEpisodeCount, standaloneCount }) {
  const parts = [];
  if (seriesCount) {
    parts.push(`${seriesCount} series`);
    parts.push(`${availableEpisodeCount} available ${availableEpisodeCount === 1 ? "episode" : "episodes"}`);
  }
  if (standaloneCount) {
    parts.push(`${standaloneCount} standalone ${standaloneCount === 1 ? "lecture" : "lectures"}`);
  }
  if (!parts.length) return "Coming soon";
  return parts.join(" · ");
}

function renderTopics() {
  const grid = document.querySelector("#explore-topic-grid");
  if (!grid) return;

  grid.innerHTML = topics
    .map((topic) => {
      const counts = countsForTopic(topic.value);
      const disabledClass = counts.totalWatchable ? "" : " is-coming-soon";
      const href = counts.totalWatchable ? `./index.html?category=${topic.value}#series` : "./pages/feedback.html";
      const actionLabel = counts.totalWatchable ? "Browse topic" : "Request this topic";

      return `
        <a
          class="explore-card${disabledClass}"
          data-category="${escapeHtml(topic.value)}"
          data-series-count="${counts.seriesCount}"
          data-episode-count="${counts.availableEpisodeCount}"
          data-standalone-count="${counts.standaloneCount}"
          data-total-watchable="${counts.totalWatchable}"
          href="${href}"
          aria-label="${escapeHtml(actionLabel)}: ${escapeHtml(topic.name)}"
        >
          <span class="explore-card-kicker">${escapeHtml(countLabel(counts))}</span>
          <span class="explore-card-title">${escapeHtml(topic.name)}</span>
          <span class="explore-card-copy">${escapeHtml(topic.description)}</span>
          <span class="explore-card-action">${escapeHtml(actionLabel)}</span>
        </a>
      `;
    })
    .join("");
}

function renderPaths() {
  const grid = document.querySelector("#explore-path-grid");
  if (!grid) return;

  grid.innerHTML = paths
    .map((path) => `
      <a class="explore-path-card" href="${path.href}">
        <span class="explore-card-title">${escapeHtml(path.title)}</span>
        <span class="explore-card-copy">${escapeHtml(path.description)}</span>
      </a>
    `)
    .join("");
}

renderTopics();
renderPaths();
