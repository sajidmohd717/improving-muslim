/*
 * Lightweight content lookups for account pages. This uses the generated
 * catalogue plus series metadata, so History and Saved do not need to execute
 * every individual series data file just to resolve a thumbnail or title.
 */
(() => {
  "use strict";

  const items = Array.isArray(window.catalogIndex?.items) ? window.catalogIndex.items : [];
  const seriesEntries = Array.isArray(window.seriesConfig) ? window.seriesConfig : [];
  const episodeByKey = new Map();
  const progressItemByKey = new Map();
  const standaloneById = new Map();
  const seriesBySlug = new Map(seriesEntries.map((series) => [String(series.slug), series]));

  for (const item of items) {
    if (item.kind === "episode") {
      episodeByKey.set(`${item.series}:${item.id}`, item);
      progressItemByKey.set(`${item.playlistId}:${item.id}`, item);
    } else if (item.kind === "standalone") {
      standaloneById.set(String(item.id), item);
      progressItemByKey.set(`standalone:${item.id}`, item);
    }
  }

  function episode(slug, id) {
    return episodeByKey.get(`${slug}:${id}`) || null;
  }

  function standalone(id) {
    return standaloneById.get(String(id)) || null;
  }

  function progressItem(playlistId, id) {
    return progressItemByKey.get(`${playlistId}:${id}`) || null;
  }

  function series(slug) {
    return seriesBySlug.get(String(slug)) || null;
  }

  function seriesFromUrl(url = "") {
    const path = String(url);
    return seriesEntries.find((entry) => path.includes(`/${entry.slug}/`) || path.endsWith(`/${entry.slug}`)) || null;
  }

  window.IMCatalogLookup = { episode, standalone, progressItem, series, seriesFromUrl };
})();
