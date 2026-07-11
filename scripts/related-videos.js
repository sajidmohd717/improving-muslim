/*
 * Related-lecture ranking over the generated catalog index
 * (data/catalog-data.js). Pure scoring only — no DOM. The watch page renders
 * the results in its sidebar.
 *
 * Ranking signals, strongest first:
 *   - term-vector similarity (cosine over the TF-IDF vectors built at
 *     generation time from titles, descriptions, keywords, and transcripts)
 *   - shared categories
 *   - same speaker
 *   - recency (mild boost for lectures published in the last two years)
 * Already-watched lectures are demoted, and greedy diversity caps stop one
 * series or speaker from flooding the list.
 */
(function () {
  "use strict";

  function dot(a, b) {
    var sum = 0;
    for (var token in a) {
      if (b[token]) sum += a[token] * b[token];
    }
    return sum;
  }

  function norm(vector) {
    var sum = 0;
    for (var token in vector) {
      sum += vector[token] * vector[token];
    }
    return Math.sqrt(sum);
  }

  function cosine(a, b) {
    if (!a || !b) return 0;
    var denominator = norm(a) * norm(b);
    return denominator > 0 ? dot(a, b) / denominator : 0;
  }

  function categoryOverlap(a, b) {
    if (!a?.length || !b?.length) return 0;
    var setB = new Set(b);
    var shared = a.filter(function (category) { return setB.has(category); }).length;
    return shared / (a.length + b.length - shared);
  }

  var RECENCY_WINDOW_MS = 2 * 365 * 24 * 60 * 60 * 1000;

  function recencyBoost(published) {
    if (!published) return 0;
    var age = Date.now() - new Date(published + "T00:00:00").getTime();
    if (!Number.isFinite(age) || age < 0 || age > RECENCY_WINDOW_MS) return 0;
    return 0.25 * (1 - age / RECENCY_WINDOW_MS);
  }

  var MAX_PER_SERIES = 2;
  var MAX_PER_SPEAKER = 3;
  var WATCHED_MULTIPLIER = 0.35;

  /**
   * options:
   *   items          catalog items (window.catalogIndex.items)
   *   currentKey     key of the lecture being watched (excluded, used as seed)
   *   excludeSeries  series slug to omit entirely (its episodes are already
   *                  listed in the sidebar), or null
   *   isWatched      optional (item) => boolean, demotes completed lectures
   *   popularity     optional {key: {p, c}} play counts (IMPopularity) used
   *                  as a mild log-scaled prior
   *   limit          max results, default 8
   */
  function rankRelated(options) {
    var items = options.items || [];
    var seed = items.find(function (item) { return item.key === options.currentKey; });
    if (!seed) return [];
    var isWatched = options.isWatched || function () { return false; };
    var popularity = options.popularity || {};
    var limit = options.limit || 8;

    var maxPlays = 0;
    items.forEach(function (item) {
      var plays = popularity[item.key]?.p || 0;
      if (plays > maxPlays) maxPlays = plays;
    });

    var scored = [];
    items.forEach(function (item) {
      if (item.key === options.currentKey) return;
      if (options.excludeSeries && item.series === options.excludeSeries) return;
      var plays = popularity[item.key]?.p || 0;
      var score =
        3 * cosine(seed.terms, item.terms) +
        1.2 * categoryOverlap(seed.categories, item.categories) +
        (item.speaker && item.speaker === seed.speaker ? 0.8 : 0) +
        recencyBoost(item.published) +
        (maxPlays > 0 ? 0.25 * (Math.log(1 + plays) / Math.log(1 + maxPlays)) : 0);
      if (isWatched(item)) score *= WATCHED_MULTIPLIER;
      if (score > 0) scored.push({ item: item, score: score });
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    var perSeries = {};
    var perSpeaker = {};
    var picked = [];
    for (var i = 0; i < scored.length && picked.length < limit; i++) {
      var item = scored[i].item;
      var seriesKey = item.series || "standalone:" + item.speaker;
      var speakerKey = item.speaker || "unknown";
      if ((perSeries[seriesKey] || 0) >= MAX_PER_SERIES) continue;
      if ((perSpeaker[speakerKey] || 0) >= MAX_PER_SPEAKER) continue;
      perSeries[seriesKey] = (perSeries[seriesKey] || 0) + 1;
      perSpeaker[speakerKey] = (perSpeaker[speakerKey] || 0) + 1;
      picked.push(item);
    }
    return picked;
  }

  window.IMRelated = { rankRelated: rankRelated };
})();
