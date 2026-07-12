const topics = (window.IMCategoryTaxonomy?.topics || []).filter((topic) => topic.public);

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

function countLabel({ totalWatchable }) {
  if (!totalWatchable) return "Coming soon";
  return `${totalWatchable} ${totalWatchable === 1 ? "lecture" : "lectures"}`;
}

function renderTopics() {
  const grid = document.querySelector("#explore-topic-grid");
  if (!grid) return;

  grid.innerHTML = topics
    .map((topic) => {
      const counts = countsForTopic(topic.value);
      const disabledClass = counts.totalWatchable ? "" : " is-coming-soon";
      const href = counts.totalWatchable
        ? `./pages/category.html?category=${encodeURIComponent(topic.value)}`
        : "./pages/feedback.html";
      const actionLabel = counts.totalWatchable ? "Open topic" : "Request topic";

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
          <span class="explore-card-action">${escapeHtml(actionLabel)} <span aria-hidden="true">→</span></span>
        </a>
      `;
    })
    .join("");
}

renderTopics();
