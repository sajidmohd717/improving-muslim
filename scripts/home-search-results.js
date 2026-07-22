/* Episode, transcript, analytics, and optional AI result orchestration. */
(() => {
  "use strict";

  function create({ state, endpoint, categoryNameMap, escapeHtml, formatDuration, catalog, itemId, onResultsChanged }) {
    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function highlightSnippet(snippet, matchedWords) {
      const escaped = escapeHtml(snippet);
      if (!matchedWords?.length) return escaped;
      const pattern = new RegExp(`(${matchedWords.map(escapeRegExp).join("|")})`, "gi");
      return escaped.replace(pattern, "<mark>$1</mark>");
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
        item._cats.forEach((category) => {
          parts.push(category);
          parts.push(categoryNameMap[category] || "");
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

    function aiPayloadItems() {
      return catalog().slice(0, 80).map((item) => ({
        id: itemId(item),
        title: item.title || "",
        speaker: item.speaker || "",
        topic: item.topic || "",
        type: item.contentType === "video" ? "video" : "series",
        text: searchTextForItem(item).slice(0, 1800),
      }));
    }

    function runEpisode(query) {
      const section = document.querySelector("#episode-section");
      const list = document.querySelector("#episode-results");
      if (!section || !list) return;
      if (!query || !window.IMEpisodeSearch || !window.catalogIndex) {
        section.hidden = true;
        list.innerHTML = "";
        return;
      }

      const results = window.IMEpisodeSearch.search({
        items: window.catalogIndex.items,
        query,
        categoryNameMap,
      });
      section.hidden = !results.length;
      list.innerHTML = results
        .map(({ item }) => {
          const duration = item.duration ? formatDuration(item.duration) : "";
          return `
            <a class="episode-result-card" href="${escapeHtml(item.url)}">
              <img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />
              <span>
                <small>${escapeHtml(item.seriesTitle)} · Ep ${item.number}${duration ? ` · ${escapeHtml(duration)}` : ""}</small>
                <strong>${escapeHtml(item.title)}</strong>
                <span class="episode-result-speaker">${escapeHtml(item.speaker || "")}</span>
              </span>
            </a>`;
        })
        .join("");
    }

    function runTranscript(query) {
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
          if (state.searchTerm !== query) return;
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

    function log(query) {
      if (!query || typeof window.IMAuth?.logSearch !== "function") return;
      window.IMAuth.logSearch({
        query,
        resultCount: document.querySelectorAll(".series-card").length,
        contentType: state.contentType,
        category: state.activeCategory,
      });
    }

    async function runAi(query) {
      if (!endpoint || !query) return;
      const requestQuery = query;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, items: aiPayloadItems() }),
        });
        if (!response.ok) throw new Error(`AI search failed (${response.status})`);
        const data = await response.json();
        if (state.searchTerm !== requestQuery) return;
        const results = Array.isArray(data.results) ? data.results : [];
        const validIds = new Set(catalog().map(itemId));
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
      onResultsChanged();
    }

    function clearSecondary() {
      runEpisode("");
      runTranscript("");
    }

    return { runEpisode, runTranscript, runAi, log, clearSecondary };
  }

  window.IMHomeSearchResults = { create };
})();
