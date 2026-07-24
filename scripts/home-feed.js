/*
 * Homepage feed ordering. Exposes window.IMHomeFeed.
 *
 * Owns *what order* grid cards appear in: the stable per-session shuffle, the
 * explicit sort modes (featured / views / A–Z), the balanced series+video
 * discovery mix, and the watch-history-seeded personalized blend that reuses
 * the catalog + IMRelated ranking (see the For You notes in DEV_README.md).
 * Pure ordering only — no DOM. script.js decides which order to apply.
 *
 * Loaded on the homepage after utils.js/related-videos.js and before
 * script.js.
 */
(() => {
  "use strict";

  const { readJsonStorage, storageKeysWithPrefix, PROGRESS_PREFIX } = window.IMUtils;

  // Stable random sort: each title gets one random key per page load, reused
  // across all category switches so the order never changes mid-session.
  const randomSortKeys = new Map();
  function stableRandomKey(title) {
    if (!randomSortKeys.has(title)) {
      randomSortKeys.set(title, Math.random());
    }
    return randomSortKeys.get(title);
  }

  function parseViewCount(str) {
    if (!str) return -1;
    const num = parseFloat(str);
    if (/[Mm]/.test(str)) return num * 1_000_000;
    if (/[Kk]/.test(str)) return num * 1_000;
    return num || -1;
  }

  function getSortedSeries(list, sortBy) {
    // "featured" is the curated registry order. The default discovery shuffle
    // is upgraded to a personalized blend on the For You feed when meaningful
    // watch history is available (see getPersonalizedHomeOrder below).
    if (sortBy === "featured") {
      return list;
    }
    if (sortBy === "random") {
      return [...list].sort((a, b) => stableRandomKey(a.title) - stableRandomKey(b.title));
    }
    if (sortBy === "views") {
      return [...list].sort((a, b) => parseViewCount(b.viewcount) - parseViewCount(a.viewcount));
    }
    if (sortBy === "az") {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }

  function catalogHomeIdentity(item) {
    if (!item) return "";
    return item.kind === "standalone" ? `video:${item.id}` : `series:${item.series}`;
  }

  function homeCardIdentity(item) {
    if (!item) return "";
    return item.contentType === "video" ? `video:${item.sourceId}` : `series:${item._seriesSlug}`;
  }

  function getDiscoveryHomeOrder(list) {
    const shuffledSeries = list
      .filter((item) => item.contentType !== "video")
      .sort((a, b) => stableRandomKey(a.title) - stableRandomKey(b.title));
    const shuffledVideos = list
      .filter((item) => item.contentType === "video")
      .sort((a, b) => stableRandomKey(a.title) - stableRandomKey(b.title));
    const mixed = [];

    // Keep the first impression balanced: series are the platform's strongest
    // differentiator, while standalone lectures still appear throughout the
    // feed. Starting with a series also gives mobile visitors the clearest cue
    // that this is more than a conventional video feed.
    while (shuffledSeries.length || shuffledVideos.length) {
      if (shuffledSeries.length) mixed.push(shuffledSeries.shift());
      if (shuffledVideos.length) mixed.push(shuffledVideos.shift());
    }

    return mixed;
  }

  function getPersonalizedHomeOrder(list) {
    const catalogItems = window.catalogIndex?.items || [];
    if (!window.IMRelated || !catalogItems.length) {
      return { items: getDiscoveryHomeOrder(list), personalized: false };
    }

    const itemByProgressKey = new Map(
      catalogItems.map((item) => [`${PROGRESS_PREFIX}${item.playlistId}:${item.id}`, item]),
    );
    const seeds = storageKeysWithPrefix(PROGRESS_PREFIX)
      .map((key) => {
        const stored = readJsonStorage(key, {});
        const item = itemByProgressKey.get(key);
        const engaged = stored.completed || (Number(stored.currentTime) || 0) >= 120;
        return item && stored.updatedAt && engaged
          ? { item, updatedAt: Number(stored.updatedAt) || 0 }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3);

    if (!seeds.length) {
      return { items: getDiscoveryHomeOrder(list), personalized: false };
    }

    const recommendationScores = new Map();
    seeds.forEach(({ item: seed }, seedIndex) => {
      const seedWeight = 1 / (seedIndex + 1);
      window.IMRelated
        .rankRelated({
          items: catalogItems,
          currentKey: seed.key,
          isWatched: (item) => Boolean(
            readJsonStorage(`${PROGRESS_PREFIX}${item.playlistId}:${item.id}`, {}).completed,
          ),
          limit: 36,
        })
        .forEach((item, rank) => {
          // Started items already have a dedicated Continue learning card.
          const progress = readJsonStorage(`${PROGRESS_PREFIX}${item.playlistId}:${item.id}`, {});
          if ((Number(progress.currentTime) || 0) >= 10 && !progress.completed) return;
          const identity = catalogHomeIdentity(item);
          if (!identity) return;
          const rankWeight = 1 - rank / 36;
          recommendationScores.set(
            identity,
            (recommendationScores.get(identity) || 0) + seedWeight * rankWeight,
          );
        });
    });

    const relevant = list
      .filter((item) => recommendationScores.has(homeCardIdentity(item)))
      .sort((a, b) => {
        const difference =
          recommendationScores.get(homeCardIdentity(b)) - recommendationScores.get(homeCardIdentity(a));
        return difference || stableRandomKey(a.title) - stableRandomKey(b.title);
      });
    if (!relevant.length) {
      return { items: getDiscoveryHomeOrder(list), personalized: false };
    }

    // Cap the recommendation pool and interleave one discovery card after every
    // two relevant cards. This keeps the feed useful without creating a bubble.
    const recommendationLimit = Math.min(12, Math.ceil(list.length / 2));
    const recommended = relevant.slice(0, recommendationLimit);
    const recommendedSet = new Set(recommended);
    const discovery = list
      .filter((item) => !recommendedSet.has(item))
      .sort((a, b) => stableRandomKey(a.title) - stableRandomKey(b.title));
    const blended = [];
    while (recommended.length || discovery.length) {
      for (let slot = 0; slot < 2 && recommended.length; slot += 1) {
        blended.push(recommended.shift());
      }
      if (discovery.length) blended.push(discovery.shift());
    }

    return { items: blended, personalized: true };
  }

  window.IMHomeFeed = {
    getSortedSeries,
    getDiscoveryHomeOrder,
    getPersonalizedHomeOrder,
  };
})();
