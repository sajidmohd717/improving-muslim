/*
 * Renders the upload roadmap from data/series-registry.js.
 * Status per series: explicit `roadmapStatus` ("scheduled") wins, otherwise
 * derived — episodes available means "uploading", none means "planned".
 * Progress comes from availableCount / episodeCount, so updating those two
 * numbers in the registry updates this page automatically.
 */
(function () {
  const grids = {
    scheduled: document.querySelector("#roadmap-scheduled"),
    uploading: document.querySelector("#roadmap-uploading"),
    planned: document.querySelector("#roadmap-planned"),
  };
  if (!grids.scheduled || !grids.uploading || !grids.planned) return;

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));

  const chips = {
    scheduled:
      '<span class="roadmap-status scheduled"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> On Track</span>',
    uploading:
      '<span class="roadmap-status uploading"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> Uploading</span>',
    planned:
      '<span class="roadmap-status planned"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Planned</span>',
  };

  function statusOf(series) {
    if (series.roadmapStatus && chips[series.roadmapStatus]) return series.roadmapStatus;
    return (Number(series.availableCount) || 0) > 0 ? "uploading" : "planned";
  }

  function card(series, status) {
    const url = `./pages/series-detail.html?id=${encodeURIComponent(series.slug)}`;
    const total = Number(series.episodeCount) || 0;
    const available = Math.min(Number(series.availableCount) || 0, total);
    const percent = total > 0 ? Math.round((available / total) * 100) : 0;
    const label = available > 0 ? `${available} of ${total} episodes uploaded` : "Upload not yet started";
    const target = status === "scheduled" && series.roadmapTarget
      ? `<div class="roadmap-target-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${escapeHtml(series.roadmapTarget)}</div>`
      : "";
    return `
      <article class="roadmap-card ${status === "scheduled" ? "is-scheduled" : ""}">
        <a href="${url}" tabindex="-1" aria-label="View ${escapeHtml(series.title)}">
          <img class="roadmap-card-thumb" src="${series.thumbnailSrc}" alt="${escapeHtml(series.title)}" loading="lazy" />
        </a>
        <div class="roadmap-card-body">
          <div class="roadmap-card-top">
            <h3><a href="${url}">${escapeHtml(series.title)}</a></h3>
            ${chips[status]}
          </div>
          <p class="roadmap-card-speaker">${escapeHtml(series.speaker)} &nbsp;&middot;&nbsp; ${total} episodes</p>
          <div class="roadmap-progress-bar" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
            <div class="roadmap-progress-fill" style="width: ${percent}%"></div>
          </div>
          <p class="roadmap-progress-label">${label}</p>
          ${target}
        </div>
      </article>
    `;
  }

  const buckets = { scheduled: [], uploading: [], planned: [] };
  for (const series of window.seriesConfig || []) {
    const status = statusOf(series);
    buckets[status].push(card(series, status));
  }

  for (const status of Object.keys(grids)) {
    grids[status].innerHTML = buckets[status].join("");
    const section = grids[status].closest("section");
    if (section) section.hidden = buckets[status].length === 0;
  }
})();
