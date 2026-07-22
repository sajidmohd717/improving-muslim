/*
 * Homepage catalogue grid: filtering, pagination, progress summaries, and
 * card rendering. The controller supplies page state and search callbacks;
 * this module owns the DOM-heavy grid lifecycle.
 */
(() => {
  "use strict";

  const {
    escapeHtml,
    formatDuration,
    getAllSeries,
    progressKey,
    readJsonStorage,
    PROGRESS_PREFIX,
  } = window.IMUtils;
  const { flattenSeries, isAllowedSeries, enrichSeries } = window.IMHomeData;
  const { getSortedSeries, getPersonalizedHomeOrder } = window.IMHomeFeed;
  const { isSeriesSaved } = window.IMCardActions;

  const skeletonLabelWidths = ["38%", "43%", "35%", "41%", "37%", "44%", "36%", "42%", "39%"];
  const skeletonTitleWidths = ["78%", "65%", "83%", "70%", "76%", "68%", "80%", "63%", "74%"];
  const skeletonMetaWidths = ["56%", "48%", "63%", "52%", "59%", "46%", "61%", "50%", "55%"];

  function create({
    state,
    els,
    batchSize,
    categories,
    getSearchSections,
    itemId,
    getItemUrl,
    homeSearch,
  }) {
    function setStatus(message, isVisible = true) {
      els.statusMessage.innerHTML = message;
      els.statusMessage.classList.toggle("is-visible", isVisible);
    }

    function showSkeletons(count = 6) {
      setStatus("", false);
      els.seriesGrid.innerHTML = Array.from({ length: count }, (_, index) => {
        const delay = index * 90;
        return `
          <div class="series-card" aria-hidden="true">
            <div class="skel skel-thumb" style="animation-delay:${delay}ms"></div>
            <div class="series-body">
              <div class="skel skel-label" style="width:${skeletonLabelWidths[index % 9]};animation-delay:${delay}ms"></div>
              <div class="skel skel-title" style="width:${skeletonTitleWidths[index % 9]};animation-delay:${delay + 50}ms"></div>
              <div class="skel skel-meta" style="width:${skeletonMetaWidths[index % 9]};animation-delay:${delay + 100}ms"></div>
            </div>
          </div>`;
      }).join("");
    }

    function seriesMatchesContentType(series) {
      if (state.contentType === "all") return true;
      if (state.contentType === "videos") return series.contentType === "video";
      return series.contentType !== "video";
    }

    function seriesMatchesSpeaker(series) {
      return !state.activeSpeaker || series.speaker === state.activeSpeaker;
    }

    function standaloneVideoProgress(sourceId) {
      if (!sourceId) return null;
      const stored = readJsonStorage(`${PROGRESS_PREFIX}standalone:${sourceId}`, {});
      const currentTime = Number(stored.currentTime) || 0;
      const duration = Number(stored.duration) || 0;
      if (!duration || currentTime < 10) return null;
      const percentage = Math.min(1, currentTime / duration);
      return percentage > 0.97 ? null : percentage;
    }

    function seriesProgressSummary(seriesTitle) {
      const localSeries = getAllSeries().find((series) => series.title === seriesTitle);
      if (!localSeries) return null;
      const watchable = localSeries.episodes.filter((episode) => episode.videoSrc);
      if (!watchable.length) return null;

      let completed = 0;
      let started = false;
      for (const episode of watchable) {
        const progress = readJsonStorage(progressKey(localSeries, episode), {});
        if (progress.completed) {
          completed += 1;
          started = true;
        } else if (progress.currentTime > 10) {
          started = true;
        }
      }
      return started ? { completed, total: watchable.length } : null;
    }

    function isItemWatched(item) {
      if (item.contentType === "video") {
        if (!item.sourceId) return false;
        return Boolean(readJsonStorage(`${PROGRESS_PREFIX}standalone:${item.sourceId}`, {}).completed);
      }
      const summary = seriesProgressSummary(item.title);
      return Boolean(summary && summary.completed >= summary.total);
    }

    function resetPagination() {
      state.visibleCount = batchSize;
    }

    function updatePagination(total, shown) {
      if (!els.catalogPagination || !els.catalogPaginationStatus || !els.catalogLoadMore) return;
      const needsPagination = total > batchSize;
      els.catalogPagination.hidden = !needsPagination;
      if (!needsPagination) {
        els.catalogPaginationStatus.textContent = "";
        els.catalogLoadMore.hidden = true;
        return;
      }

      const remaining = Math.max(0, total - shown);
      els.catalogPaginationStatus.textContent = remaining
        ? `Showing ${shown} of ${total}`
        : `Showing all ${total}`;
      els.catalogLoadMore.hidden = remaining === 0;
      if (remaining) {
        const nextBatch = Math.min(batchSize, remaining);
        els.catalogLoadMore.textContent = `Load ${nextBatch} more`;
        els.catalogLoadMore.setAttribute("aria-label", `Load ${nextBatch} more results`);
      }
    }

    function render() {
      const isSearching = Boolean(state.searchTerm);
      let personalizedHome = false;
      const aiIds = state.aiSearch.query === state.searchTerm && Array.isArray(state.aiSearch.results)
        ? state.aiSearch.results
        : null;
      const aiOrder = new Map((aiIds || []).map((id, index) => [id, index]));
      const searchScores = new Map();
      const strongIds = new Set();
      let series = flattenSeries(getSearchSections())
        .filter(isAllowedSeries)
        .filter((item) => {
          if (!isSearching) return true;
          const id = itemId(item);
          const match = homeSearch.assessSeries(item, state.searchTerm);
          if (match.score > 0) searchScores.set(id, match.score);
          if (match.strong) strongIds.add(id);
          if (aiIds) return aiOrder.has(id) || match.strong;
          return match.score > 0;
        })
        .filter(seriesMatchesSpeaker)
        .filter(seriesMatchesContentType)
        .filter((item) => !state.hideWatched || !isItemWatched(item))
        .map(enrichSeries);

      if (aiIds) {
        series = series.sort((a, b) => {
          const rankA = aiOrder.has(itemId(a)) ? aiOrder.get(itemId(a)) : Infinity;
          const rankB = aiOrder.has(itemId(b)) ? aiOrder.get(itemId(b)) : Infinity;
          if (rankA !== rankB) return rankA - rankB;
          return (searchScores.get(itemId(b)) || 0) - (searchScores.get(itemId(a)) || 0);
        });
      } else if (isSearching && state.sortBy === "random") {
        series = [...series].sort(
          (a, b) => (searchScores.get(itemId(b)) || 0) - (searchScores.get(itemId(a)) || 0),
        );
      } else if (state.sortBy === "random" && state.activeCategory === "foryou" && !state.activeSpeaker) {
        const feed = getPersonalizedHomeOrder(series);
        series = feed.items;
        personalizedHome = feed.personalized;
      } else {
        series = getSortedSeries(series, state.sortBy);
      }

      let related = [];
      if (isSearching) {
        const aiScores = state.aiSearch.scoreById || {};
        const topAiScore = aiIds ? Math.max(0, ...aiIds.map((id) => aiScores[id] || 0)) : 0;
        const isTopResult = (item) => {
          const id = itemId(item);
          if (strongIds.has(id)) return true;
          if (!aiIds || !aiOrder.has(id)) return false;
          return topAiScore <= 0 || (aiScores[id] || 0) >= topAiScore * 0.6;
        };
        related = series.filter((item) => !isTopResult(item));
        series = series.filter(isTopResult);
      }

      const categoryName = categories.find((category) => category.value === state.activeCategory)?.name || "For You";
      document.body.classList.toggle("search-mode", isSearching);
      els.activeCategoryLabel.textContent = state.activeSpeaker
        ? state.activeSpeaker
        : isSearching
        ? "Search"
        : categoryName;
      if (els.seriesTitle) {
        els.seriesTitle.textContent = isSearching
          ? `Search results for "${state.searchTerm}"`
          : state.activeCategory === "foryou"
          ? personalizedHome ? "For you" : "Discover"
          : "Lectures and series";
      }
      els.seriesGrid.dataset.feedMode = personalizedHome ? "personalized" : "discovery";

      const aiPending = state.aiSearch.pending && state.aiSearch.query === state.searchTerm;
      const videoCount = series.filter((item) => item.contentType === "video").length;
      const seriesCount = series.length - videoCount;
      const breakdownParts = [];
      if (seriesCount) breakdownParts.push(`${seriesCount} series`);
      if (videoCount) breakdownParts.push(`${videoCount} ${videoCount === 1 ? "video" : "videos"}`);
      const breakdown = breakdownParts.join(" · ") || (related.length ? "No exact matches" : "0 results");
      const relatedNote = related.length ? ` · ${related.length} related` : "";
      els.resultCount.innerHTML = aiPending
        ? `<span class="ai-search-spinner" aria-hidden="true"></span>Searching with AI… ${breakdown}${relatedNote} so far`
        : `${breakdown}${relatedNote}${aiIds ? " · ranked by AI" : ""}`;

      if (!series.length && !related.length) {
        els.seriesGrid.innerHTML = "";
        updatePagination(0, 0);
        if (aiPending) {
          setStatus(`<span class="ai-search-spinner" aria-hidden="true"></span> No instant matches for "${escapeHtml(state.searchTerm)}" — AI is searching descriptions and topics. This can take a few seconds…`);
          return;
        }
        const aiEmptyMessage = state.aiSearch.query === state.searchTerm ? state.aiSearch.message : "";
        setStatus(
          state.searchTerm
            ? aiEmptyMessage
              ? `${escapeHtml(aiEmptyMessage)} In the meantime, <a href="./pages/explore.html">browse by topic on Explore</a>.`
              : `We don't have lectures on "${escapeHtml(state.searchTerm)}" just yet — but we're adding new topics regularly, and your search helps us decide what to upload next. In the meantime, <a href="./pages/explore.html">browse by topic on Explore</a>.`
            : 'No lectures in this category yet. <a href="./pages/explore.html">Browse by topic on Explore</a> or check back soon.',
        );
        return;
      }

      setStatus("", false);
      const seriesCardHtml = (item, index) => {
        const url = getItemUrl(item);
        const isVideo = item.contentType === "video";
        const seriesProgress = isVideo ? null : seriesProgressSummary(item.title);
        const videoProgress = isVideo ? standaloneVideoProgress(item.sourceId) : null;
        const saved = isSeriesSaved(url);
        const durationChip = isVideo && item.duration
          ? `<span class="thumb-duration">${formatDuration(item.duration)}</span>`
          : "";
        const parsedEpisodeCount = Number.parseInt(String(item.episodes || ""), 10);
        const episodeCount = Number(item.episodeCount) || parsedEpisodeCount || 0;
        const episodeChip = !isVideo && episodeCount > 0
          ? `<span class="thumb-duration">${episodeCount} ${episodeCount === 1 ? "Episode" : "Episodes"}</span>`
          : "";
        const progressBarHtml = seriesProgress
          ? `<div class="thumb-progress-track" aria-label="${seriesProgress.completed} of ${seriesProgress.total} episodes watched"><div class="thumb-progress-fill" style="width:${Math.round(seriesProgress.completed / seriesProgress.total * 100)}%"></div></div>`
          : videoProgress !== null
          ? `<div class="thumb-progress-track" aria-label="${Math.round(videoProgress * 100)}% watched"><div class="thumb-progress-fill" style="width:${Math.round(videoProgress * 100)}%"></div></div>`
          : "";
        return `
          <article class="series-card reveal-anim" style="--reveal-delay:${Math.min(index, 8) * 50}ms">
            <a class="series-link" href="${url}">
              <img src="${item.thumbnailImage}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.onerror=null;this.src='./public/social-preview.png';" />
              ${durationChip}
              ${episodeChip}
              ${progressBarHtml}
            </a>
            <div class="series-body">
              <span class="series-topic">${isVideo ? "Lecture" : "Series"} · ${escapeHtml(item.topic || "General")}</span>
              <a class="series-title" href="${url}">${escapeHtml(item.title)}</a>
              <div class="series-meta">
                <span>${escapeHtml(item.speaker || "Speaker TBA")}</span>
                ${item.viewcount ? `<span>${escapeHtml(item.viewcount)}</span>` : ""}
              </div>
              ${state.aiSearch.reasonById[itemId(item)] ? '<span class="label-badge label-ai">AI match</span>' : ""}
              <button class="card-menu-trigger" type="button" aria-label="More options" aria-expanded="false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg>
              </button>
              <div class="card-menu" hidden>
                <button class="card-menu-item save-series-button" type="button" data-series-url="${escapeHtml(url)}" aria-pressed="${saved}" aria-label="${saved ? "Remove saved item" : `Save ${isVideo ? "video" : "series"}`}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  <span>${saved ? "Saved" : "Save"}</span>
                </button>
                <button class="card-menu-item share-series-button" type="button" data-series-url="${escapeHtml(url)}" aria-label="Share ${isVideo ? "video" : "series"}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  <span>Share</span>
                </button>
              </div>
            </div>
          </article>`;
      };

      const totalResults = series.length + related.length;
      const shown = Math.min(state.visibleCount, totalResults);
      const visibleSeries = series.slice(0, shown);
      const relatedSlots = Math.max(0, shown - series.length);
      const visibleRelated = related.slice(0, relatedSlots);
      const relatedDivider = visibleRelated.length
        ? `<div class="related-divider" role="separator">${
          series.length
            ? "Not exact matches — possibly related"
            : `No exact matches for "${escapeHtml(state.searchTerm)}" — but these touch on it`
        }</div>`
        : "";

      const focused = els.seriesGrid.contains(document.activeElement) ? document.activeElement : null;
      const focusedHref = focused?.closest("a")?.getAttribute("href") || null;
      els.seriesGrid.innerHTML =
        visibleSeries.map(seriesCardHtml).join("") +
        relatedDivider +
        visibleRelated.map((item, index) => seriesCardHtml(item, series.length + index)).join("");
      if (focusedHref) {
        els.seriesGrid.querySelector(`a[href="${CSS.escape(focusedHref)}"]`)?.focus();
      }
      updatePagination(totalResults, shown);
    }

    function scrollToResults() {
      const target = document.querySelector("#series");
      if (!target) return;
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
    }

    return { setStatus, showSkeletons, resetPagination, render, scrollToResults };
  }

  window.IMHomeGrid = { create };
})();
