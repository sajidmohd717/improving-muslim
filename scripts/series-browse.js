/*
 * Renders the Browse page series grid from data/series-registry.js.
 * The registry is the single source of truth: series added or removed
 * there appear or disappear here automatically.
 */
(function () {
  const grid = document.querySelector("#browse-grid");
  if (!grid) return;

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));

  grid.innerHTML = (window.seriesConfig || [])
    .map((series) => {
      const url = `./series/${encodeURIComponent(series.slug)}/`;
      const total = Number(series.episodeCount) || 0;
      const episodeLabel = `${total} ${total === 1 ? "Episode" : "Episodes"}`;
      return `
        <li class="series-card">
          <a class="series-link" href="${url}" aria-label="${escapeHtml(series.title)} series">
            <img src="${series.thumbnailSrc}" alt="${escapeHtml(series.title)} thumbnail" loading="lazy" />
            <span class="thumb-duration">${episodeLabel}</span>
          </a>
          <div class="series-body">
            <span class="series-topic">${escapeHtml(series.sectionTitle || "Series")}</span>
            <p class="series-title">${escapeHtml(series.title)}</p>
            <div class="series-meta">
              <span>${escapeHtml(series.speaker)}</span>
            </div>
            <a class="primary-link" href="${url}">View series</a>
          </div>
        </li>
      `;
    })
    .join("");
})();
