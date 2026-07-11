/*
 * Client for the popularity Worker (workers/popularity-worker.js).
 *
 * - logPlay(key) / logComplete(key): fire-and-forget anonymous counters,
 *   deduped to once per lecture per event per device per day.
 * - cachedCounts(): synchronous {key: {p, c}} from the localStorage cache
 *   (possibly stale, possibly empty) — safe to use during page render.
 * - refreshCounts(): fetches fresh counts into the cache; resolves with the
 *   best available map. Callers that can wait (the homepage trending shelf)
 *   use this; callers that cannot (watch-page ranking) use cachedCounts()
 *   and fire refreshCounts() for next time.
 *
 * Everything degrades silently when the endpoint is unreachable or not yet
 * deployed: no errors, no shelf, no ranking boost.
 */
(function () {
  "use strict";

  var ENDPOINT = "https://improving-muslim-popularity.improving-muslim.workers.dev";
  var CACHE_KEY = "popularity-counts-cache";
  var SENT_PREFIX = "popularity-sent:";
  var CACHE_TTL_MS = 30 * 60 * 1000;

  var readJsonStorage = window.IMUtils?.readJsonStorage;
  var writeJsonStorage = window.IMUtils?.writeJsonStorage;
  var localDateKey = window.IMUtils?.localDateKey;

  function logEvent(key, event) {
    if (!ENDPOINT || !key || !readJsonStorage) return;
    var sentKey = SENT_PREFIX + event + ":" + key + ":" + (localDateKey ? localDateKey() : "");
    try {
      if (localStorage.getItem(sentKey)) return;
      localStorage.setItem(sentKey, "1");
    } catch (error) {
      // Private mode: still send, just without the daily dedupe.
    }
    fetch(ENDPOINT + "/event", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key, event: event }),
    }).catch(function () { /* best-effort */ });
  }

  function cachedCounts() {
    if (!readJsonStorage) return {};
    var cache = readJsonStorage(CACHE_KEY, null);
    return cache && cache.items ? cache.items : {};
  }

  var refreshPromise = null;

  function refreshCounts() {
    if (!ENDPOINT || !readJsonStorage) return Promise.resolve(cachedCounts());
    var cache = readJsonStorage(CACHE_KEY, null);
    if (cache && cache.items && Date.now() - (cache.at || 0) < CACHE_TTL_MS) {
      return Promise.resolve(cache.items);
    }
    if (refreshPromise) return refreshPromise;
    refreshPromise = fetch(ENDPOINT + "/popular")
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        refreshPromise = null;
        if (!data || typeof data.items !== "object") return cachedCounts();
        if (writeJsonStorage) writeJsonStorage(CACHE_KEY, { at: Date.now(), items: data.items });
        return data.items;
      })
      .catch(function () {
        refreshPromise = null;
        return cachedCounts();
      });
    return refreshPromise;
  }

  window.IMPopularity = {
    logPlay: function (key) { logEvent(key, "play"); },
    logComplete: function (key) { logEvent(key, "complete"); },
    cachedCounts: cachedCounts,
    refreshCounts: refreshCounts,
  };
})();
