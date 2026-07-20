// Homepage controller: page state, the main results grid, search result
// rendering, and event wiring. The heavy lifting lives in focused modules
// loaded before this file:
//   - home-data.js (IMHomeData): section assembly, merging, allow-list filter
//   - home-feed.js (IMHomeFeed): shuffle/sort/personalized feed ordering
//   - home-shelves.js (IMHomeShelves): Continue, Popular, streak, speakers
//   - home-card-actions.js (IMCardActions): card save/share/menu actions
const homeConfig = window.IMHomeConfig || {};
const API_ROOT = homeConfig.apiRoot || "https://sajidmohd717.github.io/series-api";
const CATALOG_VERSION = homeConfig.catalogVersion || "1";
const AI_SEARCH_ENDPOINT = homeConfig.aiSearchEndpoint || "";
const descriptions = homeConfig.descriptions || {};

const {
  escapeHtml,
  formatDuration,
  getAllSeries,
  progressKey,
  readJsonStorage,
  PROGRESS_PREFIX,
  seriesUrl,
} = window.IMUtils;

const {
  categories,
  categoryNameMap,
  fallbackData,
  localCategoryFallbacks,
  localFirstCategories,
  isAllowedSeries,
  cleanJson,
  normalizeSections,
  flattenSeries,
  uniqueBy,
  enrichSeries,
  mergeLocalSeries,
} = window.IMHomeData;

const { getSortedSeries, getPersonalizedHomeOrder } = window.IMHomeFeed;
const { isSeriesSaved, toggleSavedSeries, shareSeries, closeCardMenu } = window.IMCardActions;
const {
  renderContinueWatching,
  renderPopularShelf,
  renderStudyStreak,
  renderSpeakers,
} = window.IMHomeShelves;

function initialCategoryFromUrl() {
  const requestedCategory = new URLSearchParams(window.location.search).get("category");
  return categories.some((category) => category.value === requestedCategory) ? requestedCategory : "foryou";
}

function searchFromUrl() {
  return String(new URLSearchParams(window.location.search).get("q") || "").trim().replace(/\s+/g, " ").toLowerCase();
}

const catalogBatchSize = window.matchMedia?.("(max-width: 600px)").matches ? 18 : 36;

const state = {
  activeCategory: initialCategoryFromUrl(),
  sections: [],
  searchTerm: searchFromUrl(),
  sortBy: "random",
  activeSpeaker: null,
  contentType: "all",
  hideWatched: localStorage.getItem("im-hide-watched") === "true",
  visibleCount: catalogBatchSize,
  aiSearch: {
    query: "",
    pending: false,
    results: null,
    reasonById: {},
    scoreById: {},
    message: "",
  },
};

function searchSections() {
  if (!state.searchTerm) return state.sections;
  return mergeLocalSeries(state.sections, "foryou");
}

const els = {
  menuToggle: document.querySelector(".menu-toggle"),
  siteMenu: document.querySelector("#site-menu"),
  continueList: document.querySelector("#continue-list"),
  categoryList: document.querySelector("#category-list"),
  seriesGrid: document.querySelector("#series-grid"),
  statusMessage: document.querySelector("#status-message"),
  resultCount: document.querySelector("#result-count"),
  seriesTitle: document.querySelector("#series-title"),
  searchForm: document.querySelector(".search-form"),
  searchInput: document.querySelector("#series-search"),
  searchSuggestions: document.querySelector("#search-suggestions"),
  sortTrigger: document.querySelector("#sort-trigger"),
  sortDisplay: document.querySelector("#sort-display"),
  sortOptions: document.querySelector("#sort-options"),
  contentTypeFilter: document.querySelector("#content-type-filter"),
  activeCategoryLabel: document.querySelector("#active-category-label"),
  hideWatchedBtn: document.querySelector("#hide-watched-btn"),
  catalogPagination: document.querySelector("#catalog-pagination"),
  catalogPaginationStatus: document.querySelector("#catalog-pagination-status"),
  catalogLoadMore: document.querySelector("#catalog-load-more"),
};

function searchCatalog() {
  return uniqueBy(
    flattenSeries(mergeLocalSeries(state.sections, "foryou")).filter(isAllowedSeries),
    searchItemId,
  );
}

function searchItemId(item) {
  return `${item.contentType || "series"}:${getSeriesUrl(item)}:${item.title}`.toLowerCase();
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
    item._cats.forEach((cat) => {
      parts.push(cat);
      parts.push(categoryNameMap[cat] || "");
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

function aiSearchPayloadItems() {
  return searchCatalog().slice(0, 80).map((item) => ({
    id: searchItemId(item),
    title: item.title || "",
    speaker: item.speaker || "",
    topic: item.topic || "",
    type: item.contentType === "video" ? "video" : "series",
    text: searchTextForItem(item).slice(0, 1800),
  }));
}

// ── Transcript search results ────────────────────────────────────────────────
// "Mentioned inside lectures": IMTranscriptSearch finds the lectures whose
// captions mention the query and the exact moments they do; each moment links
// to the watch page with a ?t= timestamp. Rendered below the catalogue results
// so title/topic matches always come first.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSnippet(snippet, matchedWords) {
  const escaped = escapeHtml(snippet);
  if (!matchedWords?.length) return escaped;
  const pattern = new RegExp(`(${matchedWords.map(escapeRegExp).join("|")})`, "gi");
  return escaped.replace(pattern, "<mark>$1</mark>");
}

// ── Episode search results ───────────────────────────────────────────────────
// "Matching episodes": IMEpisodeSearch surfaces the specific series episodes
// whose own title or transcript matches the query, so "year of the elephant"
// deep-links to that episode instead of only showing the whole series card.
// Rendered between the catalogue results and the transcript moments.
function runEpisodeSearch(query) {
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

function runTranscriptSearch(query) {
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
      if (state.searchTerm !== query) return; // stale response for an older query
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

const homeSearch = window.IMHomeSearch.create({
  els,
  escapeHtml,
  formatDuration,
  categoryNameMap,
  catalog: searchCatalog,
  onSubmit(query) {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.pushState({}, "", url);
    state.searchTerm = query;
    state.aiSearch = { query, pending: Boolean(query && AI_SEARCH_ENDPOINT), results: null, reasonById: {}, scoreById: {}, message: "" };
    resetCatalogPagination();
    renderSeries();
    runEpisodeSearch(query);
    runTranscriptSearch(query);
    if (query) {
      scrollToSeriesResults();
      logSearch(query);
      runAiSearch(query);
    }
  },
});

if (els.searchInput && state.searchTerm) els.searchInput.value = state.searchTerm;

function setStatus(message, isVisible = true) {
  els.statusMessage.innerHTML = message;
  els.statusMessage.classList.toggle("is-visible", isVisible);
}

const skelLabelW = ["38%", "43%", "35%", "41%", "37%", "44%", "36%", "42%", "39%"];
const skelTitleW = ["78%", "65%", "83%", "70%", "76%", "68%", "80%", "63%", "74%"];
const skelMetaW  = ["56%", "48%", "63%", "52%", "59%", "46%", "61%", "50%", "55%"];

function showSkeletons(count = 6) {
  setStatus("", false);
  els.seriesGrid.innerHTML = Array.from({ length: count }, (_, i) => {
    const delay = i * 90;
    return `
      <div class="series-card" aria-hidden="true">
        <div class="skel skel-thumb" style="animation-delay:${delay}ms"></div>
        <div class="series-body">
          <div class="skel skel-label" style="width:${skelLabelW[i % 9]};animation-delay:${delay}ms"></div>
          <div class="skel skel-title" style="width:${skelTitleW[i % 9]};animation-delay:${delay + 50}ms"></div>
          <div class="skel skel-meta"  style="width:${skelMetaW[i % 9]};animation-delay:${delay + 100}ms"></div>
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
  if (!state.activeSpeaker) return true;
  return series.speaker === state.activeSpeaker;
}

function isItemWatched(item) {
  if (item.contentType === "video") {
    if (!item.sourceId) return false;
    const stored = readJsonStorage(`${PROGRESS_PREFIX}standalone:${item.sourceId}`, {});
    return Boolean(stored.completed);
  }
  const summary = seriesProgressSummary(item.title);
  return Boolean(summary && summary.completed >= summary.total);
}

function standaloneVideoProgress(sourceId) {
  if (!sourceId) return null;
  const stored = readJsonStorage(`${PROGRESS_PREFIX}standalone:${sourceId}`, {});
  const currentTime = Number(stored.currentTime) || 0;
  const duration = Number(stored.duration) || 0;
  if (!duration || currentTime < 10) return null;
  const pct = Math.min(1, currentTime / duration);
  if (pct > 0.97) return null; // completed — don't clutter the card
  return pct;
}

function seriesProgressSummary(seriesTitle) {
  const localSeries = getAllSeries().find((s) => s.title === seriesTitle);
  if (!localSeries) return null;
  const watchable = localSeries.episodes.filter((e) => e.videoSrc);
  if (!watchable.length) return null;
  let completed = 0;
  let started = false;
  for (const ep of watchable) {
    const p = readJsonStorage(progressKey(localSeries, ep), {});
    if (p.completed) { completed++; started = true; }
    else if (p.currentTime > 10) { started = true; }
  }
  if (!started) return null;
  return { completed, total: watchable.length };
}

function getSeriesUrl(series) {
  if (series.contentType === "video") return series.link;
  const local = getAllSeries().find(s => s.title === series.title);
  if (local) return seriesUrl(local);
  return series.link;
}

function resetCatalogPagination() {
  state.visibleCount = catalogBatchSize;
}

function updateCatalogPagination(total, shown) {
  if (!els.catalogPagination || !els.catalogPaginationStatus || !els.catalogLoadMore) return;
  const needsPagination = total > catalogBatchSize;
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
    const nextBatch = Math.min(catalogBatchSize, remaining);
    els.catalogLoadMore.textContent = `Load ${nextBatch} more`;
    els.catalogLoadMore.setAttribute("aria-label", `Load ${nextBatch} more results`);
  }
}

function renderSeries() {
  const isSearching = Boolean(state.searchTerm);
  let personalizedHome = false;
  const aiIds = state.aiSearch.query === state.searchTerm && Array.isArray(state.aiSearch.results)
    ? state.aiSearch.results
    : null;
  const aiOrder = new Map((aiIds || []).map((id, index) => [id, index]));
  const searchScores = new Map();
  const strongIds = new Set();
  let series = flattenSeries(searchSections())
    .filter(isAllowedSeries)
    .filter((item) => {
      if (!isSearching) return true;
      const id = searchItemId(item);
      const match = homeSearch.assessSeries(item, state.searchTerm);
      if (match.score > 0) searchScores.set(id, match.score);
      if (match.strong) strongIds.add(id);
      // AI ranking augments the keyword results, it must not shrink them:
      // strong keyword matches stay even when the AI ranker omits them.
      if (aiIds) return aiOrder.has(id) || match.strong;
      return match.score > 0;
    })
    .filter(seriesMatchesSpeaker)
    .filter(seriesMatchesContentType)
    .filter((item) => !state.hideWatched || !isItemWatched(item))
    .map(enrichSeries);
  if (aiIds) {
    series = series.sort((a, b) => {
        const rankA = aiOrder.has(searchItemId(a)) ? aiOrder.get(searchItemId(a)) : Infinity;
        const rankB = aiOrder.has(searchItemId(b)) ? aiOrder.get(searchItemId(b)) : Infinity;
        if (rankA !== rankB) return rankA - rankB;
        return (searchScores.get(searchItemId(b)) || 0) - (searchScores.get(searchItemId(a)) || 0);
      });
  } else if (isSearching && state.sortBy === "random") {
    series = [...series].sort(
      (a, b) => (searchScores.get(searchItemId(b)) || 0) - (searchScores.get(searchItemId(a)) || 0),
    );
  } else if (state.sortBy === "random" && state.activeCategory === "foryou" && !state.activeSpeaker) {
    const feed = getPersonalizedHomeOrder(series);
    series = feed.items;
    personalizedHome = feed.personalized;
  } else {
    series = getSortedSeries(series, state.sortBy);
  }

  // Items that only matched buried text (recaps, keyword lists) are shown
  // under a "possibly related" divider instead of posing as real results.
  // Once AI scores arrive, the same applies to AI-ranked items that score
  // well below the AI's best match: they trail as "related" too.
  let related = [];
  if (isSearching) {
    const aiScores = state.aiSearch.scoreById || {};
    const topAiScore = aiIds ? Math.max(0, ...aiIds.map((id) => aiScores[id] || 0)) : 0;
    const isTopResult = (item) => {
      const id = searchItemId(item);
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
    updateCatalogPagination(0, 0);
    if (aiPending) {
      setStatus(
        `<span class="ai-search-spinner" aria-hidden="true"></span> No instant matches for "${escapeHtml(state.searchTerm)}" — AI is searching descriptions and topics. This can take a few seconds…`
      );
      return;
    }
    const aiEmptyMessage = state.aiSearch.query === state.searchTerm ? state.aiSearch.message : "";
    setStatus(
      state.searchTerm
        ? aiEmptyMessage
          ? `${escapeHtml(aiEmptyMessage)} In the meantime, <a href="./pages/explore.html">browse by topic on Explore</a>.`
          : `We don't have lectures on "${escapeHtml(state.searchTerm)}" just yet — but we're adding new topics regularly, and your search helps us decide what to upload next. In the meantime, <a href="./pages/explore.html">browse by topic on Explore</a>.`
        : 'No lectures in this category yet. <a href="./pages/explore.html">Browse by topic on Explore</a> or check back soon.'
    );
    return;
  }

  setStatus("", false);
  const seriesCardHtml = (item, i) => {
      const seriesUrl = getSeriesUrl(item);
      const isVideo = item.contentType === "video";
      const description =
        item.description ||
        descriptions[item.title] ||
        "Open the playlist to explore the complete lecture series on YouTube.";
      const seriesProgress = isVideo ? null : seriesProgressSummary(item.title);
      const videoProgress = isVideo ? standaloneVideoProgress(item.sourceId) : null;
      const saved = isSeriesSaved(seriesUrl);
      const durationChip = isVideo && item.duration
        ? `<span class="thumb-duration">${formatDuration(item.duration)}</span>`
        : "";
      const progressBarHtml = seriesProgress
        ? `<div class="thumb-progress-track" aria-label="${seriesProgress.completed} of ${seriesProgress.total} episodes watched"><div class="thumb-progress-fill" style="width:${Math.round(seriesProgress.completed / seriesProgress.total * 100)}%"></div></div>`
        : videoProgress !== null
        ? `<div class="thumb-progress-track" aria-label="${Math.round(videoProgress * 100)}% watched"><div class="thumb-progress-fill" style="width:${Math.round(videoProgress * 100)}%"></div></div>`
        : "";
      return `
        <article class="series-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 50}ms">
          <a class="series-link" href="${seriesUrl}">
            <img src="${item.thumbnailImage}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.onerror=null;this.src='./public/social-preview.png';" />
            ${durationChip}
            ${progressBarHtml}
          </a>
          <div class="series-body">
            <span class="series-topic">${isVideo ? "Lecture" : "Series"} · ${escapeHtml(item.topic || "General")}</span>
            <a class="series-title" href="${seriesUrl}">
              ${escapeHtml(item.title)}
            </a>
            <div class="series-meta">
              <span>${escapeHtml(item.speaker || "Speaker TBA")}</span>
              ${item.viewcount ? `<span>${escapeHtml(item.viewcount)}</span>` : ""}
            </div>
            ${item._label ? `<span class="label-badge label-${item._label.toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(item._label)}</span>` : ""}
            ${state.aiSearch.reasonById[searchItemId(item)] ? `<span class="label-badge label-ai">AI match</span>` : ""}
            ${item._badge
              ? `<span class="avail-badge ${item._badge.cls}">${escapeHtml(item._badge.text)}</span>`
              : !isVideo && item.episodes ? `<span class="avail-badge-plain ${item.episodesCls || ''}">${escapeHtml(item.episodes)}</span>` : ""
            }
            <button class="card-menu-trigger" type="button" aria-label="More options" aria-expanded="false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg>
            </button>
            <div class="card-menu" hidden>
              <button class="card-menu-item save-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-pressed="${saved}" aria-label="${saved ? "Remove saved item" : `Save ${isVideo ? "video" : "series"}`}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>${saved ? "Saved" : "Save"}</span>
              </button>
              <button class="card-menu-item share-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-label="Share ${isVideo ? "video" : "series"}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <span>Share</span>
              </button>
            </div>
          </div>
        </article>
      `;
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
  // A re-render can land while the user is keyboard-navigating the grid (late
  // remote feed merge, popularity refresh). Rebuilding innerHTML would drop
  // their focus to <body>, so restore it to the same link in the new DOM.
  const focused = els.seriesGrid.contains(document.activeElement) ? document.activeElement : null;
  const focusedHref = focused?.closest("a")?.getAttribute("href") || null;
  els.seriesGrid.innerHTML =
    visibleSeries.map(seriesCardHtml).join("") +
    relatedDivider +
    visibleRelated.map((item, i) => seriesCardHtml(item, series.length + i)).join("");
  if (focusedHref) {
    els.seriesGrid.querySelector(`a[href="${CSS.escape(focusedHref)}"]`)?.focus();
  }
  updateCatalogPagination(totalResults, shown);
}

function scrollToSeriesResults() {
  const target = document.querySelector("#series");
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function logSearch(query) {
  if (!query || !window.IMAuth || typeof window.IMAuth.logSearch !== "function") return;
  window.IMAuth.logSearch({
    query,
    resultCount: document.querySelectorAll(".series-card").length,
    contentType: state.contentType,
    category: state.activeCategory,
  });
}

async function runAiSearch(query) {
  if (!AI_SEARCH_ENDPOINT || !query) return;
  const requestQuery = query;
  try {
    const response = await fetch(AI_SEARCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        items: aiSearchPayloadItems(),
      }),
    });
    if (!response.ok) throw new Error(`AI search failed (${response.status})`);
    const data = await response.json();
    if (state.searchTerm !== requestQuery) return;
    const results = Array.isArray(data.results) ? data.results : [];
    const validIds = new Set(searchCatalog().map(searchItemId));
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
  renderSeries();
}

function renderCategories() {
  els.categoryList.innerHTML = categories
    .map(
      (category) => `
        <button
          class="category-button ${category.value === state.activeCategory ? "is-active" : ""}"
          type="button"
          data-category="${category.value}"
        >
          ${escapeHtml(category.name)}
        </button>
      `,
    )
    .join("");
}

async function loadCategory(category, { preserveSearch = false } = {}) {
  state.activeCategory = category;
  if (!preserveSearch) {
    state.searchTerm = "";
    const url = new URL(window.location.href);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      window.history.pushState({}, "", url);
    }
  }
  resetCatalogPagination();
  state.aiSearch = preserveSearch
    ? { query: state.searchTerm, pending: Boolean(state.searchTerm && AI_SEARCH_ENDPOINT), results: null, reasonById: {}, scoreById: {}, message: "" }
    : { query: "", pending: false, results: null, reasonById: {}, scoreById: {}, message: "" };
  if (!preserveSearch) {
    homeSearch.reset();
    runEpisodeSearch("");
    runTranscriptSearch("");
  }
  renderCategories();
  showSkeletons(6);

  if (localFirstCategories.has(category)) {
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category]), category);
    renderSeries();
    return;
  }

  try {
    const response = await fetch(
      `${API_ROOT}/${category}-data.json?v=${encodeURIComponent(CATALOG_VERSION)}`,
    );
    if (!response.ok) {
      throw new Error(`Could not load ${category}`);
    }

    const rawText = await response.text();
    state.sections = mergeLocalSeries(normalizeSections(JSON.parse(cleanJson(rawText))), category);
  } catch (error) {
    console.warn(error);
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category] || fallbackData), category);
    setStatus(
      `Live data could not be loaded, so a saved starter collection is shown. <button class="retry-button" type="button">Retry</button>`,
    );
  }

  renderSeries();
}

function bindEvents() {
  if (els.menuToggle) {
    els.menuToggle.addEventListener("click", () => {
      const isOpen = els.siteMenu.classList.toggle("is-open");
      document.body.classList.toggle("menu-open", isOpen);
      els.menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    els.siteMenu.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        els.siteMenu.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        els.menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  els.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }
    state.activeSpeaker = null;
    loadCategory(button.dataset.category);
  });

  els.contentTypeFilter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-content-type]");
    if (!button) return;
    state.contentType = button.dataset.contentType;
    resetCatalogPagination();
    els.contentTypeFilter.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderSeries();
  });

  function syncHideWatchedBtn() {
    if (!els.hideWatchedBtn) return;
    els.hideWatchedBtn.setAttribute("aria-pressed", String(state.hideWatched));
    els.hideWatchedBtn.classList.toggle("is-active", state.hideWatched);
    els.hideWatchedBtn.querySelector("span").textContent = state.hideWatched ? "Show watched" : "Hide watched";
  }

  els.hideWatchedBtn?.addEventListener("click", () => {
    state.hideWatched = !state.hideWatched;
    resetCatalogPagination();
    localStorage.setItem("im-hide-watched", state.hideWatched);
    syncHideWatchedBtn();
    renderSeries();
  });

  syncHideWatchedBtn();

  els.seriesGrid.addEventListener("click", (event) => {
    const menuTrigger = event.target.closest(".card-menu-trigger");
    if (menuTrigger) {
      const menu = menuTrigger.nextElementSibling;
      document.querySelectorAll(".card-menu:not([hidden])").forEach((m) => {
        if (m !== menu) closeCardMenu(m);
      });
      const opening = menu.hidden;
      menu.hidden = !opening;
      menuTrigger.setAttribute("aria-expanded", String(opening));
      menuTrigger.closest(".series-card").style.zIndex = opening ? "10" : "";
      return;
    }

    const saveButton = event.target.closest(".save-series-button");
    if (saveButton) {
      const card = saveButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(searchSections()).find((series) => series.title === title);
      if (item) toggleSavedSeries(item, saveButton.dataset.seriesUrl, saveButton);
      closeCardMenu(saveButton.closest(".card-menu"));
      return;
    }

    const shareButton = event.target.closest(".share-series-button");
    if (shareButton) {
      const card = shareButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(searchSections()).find((series) => series.title === title);
      if (item) shareSeries(item, shareButton.dataset.seriesUrl, shareButton);
      closeCardMenu(shareButton.closest(".card-menu"));
      return;
    }

  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".series-card")) {
      document.querySelectorAll(".card-menu:not([hidden])").forEach(closeCardMenu);
    }
  });

  homeSearch.init();

  els.statusMessage.addEventListener("click", (event) => {
    if (event.target.matches(".retry-button")) {
      loadCategory(state.activeCategory);
    }
  });

  const sortLabels = { random: "Default", featured: "Featured order", views: "Most viewed", az: "A–Z" };

  els.sortTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !els.sortOptions.hidden;
    els.sortOptions.hidden = isOpen;
    els.sortTrigger.setAttribute("aria-expanded", String(!isOpen));
  });

  els.sortOptions?.addEventListener("click", (e) => {
    const option = e.target.closest(".sort-option");
    if (!option) return;
    const value = option.dataset.value;
    state.sortBy = value;
    resetCatalogPagination();
    els.sortDisplay.textContent = sortLabels[value] || value;
    els.sortOptions.querySelectorAll(".sort-option").forEach((o) => {
      o.classList.toggle("is-selected", o === option);
      o.setAttribute("aria-selected", String(o === option));
    });
    els.sortOptions.hidden = true;
    els.sortTrigger.setAttribute("aria-expanded", "false");
    renderSeries();
  });

  els.catalogLoadMore?.addEventListener("click", () => {
    const previouslyShown = els.seriesGrid.querySelectorAll(".series-card").length;
    state.visibleCount += catalogBatchSize;
    renderSeries();
    // Query inside the frame callback: a re-render landing between click and
    // rAF (remote feed merge, popularity refresh) replaces the card nodes, and
    // focusing a captured-but-detached node silently does nothing.
    window.requestAnimationFrame(() => {
      const cards = els.seriesGrid.querySelectorAll(".series-card");
      cards[previouslyShown]?.querySelector(".series-title")?.focus();
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#sort-dropdown")) {
      if (els.sortOptions) els.sortOptions.hidden = true;
      els.sortTrigger?.setAttribute("aria-expanded", "false");
    }
  });
}

renderSpeakers();
renderCategories();
renderContinueWatching();
renderPopularShelf();
renderStudyStreak();
bindEvents();
loadCategory(state.activeCategory, { preserveSearch: Boolean(state.searchTerm) }).then(() => {
  if (!state.searchTerm) return;
  runEpisodeSearch(state.searchTerm);
  runTranscriptSearch(state.searchTerm);
  runAiSearch(state.searchTerm);
});

window.addEventListener("popstate", () => {
  const query = searchFromUrl();
  state.searchTerm = query;
  state.aiSearch = { query, pending: Boolean(query && AI_SEARCH_ENDPOINT), results: null, reasonById: {}, scoreById: {}, message: "" };
  resetCatalogPagination();
  if (els.searchInput) els.searchInput.value = query;
  renderSeries();
  runEpisodeSearch(query);
  runTranscriptSearch(query);
  if (query) runAiSearch(query);
});

els.continueList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".continue-remove");
  if (!btn) return;
  const card = btn.closest("[data-progress-key]");
  if (!card) return;
  try { localStorage.removeItem(card.dataset.progressKey); } catch {}
  renderContinueWatching();
  renderStudyStreak();
  renderSeries();
});

window.addEventListener("im-auth-state-changed", () => {
  renderContinueWatching();
  renderStudyStreak();
  renderSeries();
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        sectionObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.06, rootMargin: "0px 0px -32px 0px" },
);

document.querySelectorAll("[data-reveal]").forEach((el) => {
  if (el.getBoundingClientRect().top > window.innerHeight) {
    el.classList.add("section-reveal");
    sectionObserver.observe(el);
  }
});
