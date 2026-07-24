// Homepage controller: page state, the main results grid, search result
// rendering, and event wiring. The heavy lifting lives in focused modules
// loaded before this file:
//   - home-data.js (IMHomeData): section assembly, merging, allow-list filter
//   - home-feed.js (IMHomeFeed): shuffle/sort/personalized feed ordering
//   - home-shelves.js (IMHomeShelves): Continue and streak
//   - home-card-actions.js (IMCardActions): card save/share/menu actions
function requireHomeDependency(name, expectedAsset) {
  const dependency = window[name];
  if (dependency) return dependency;
  const error = new Error(`Required homepage dependency ${name} is unavailable.`);
  error.name = "MissingDependencyError";
  error.dependency = name;
  error.expectedAsset = expectedAsset;
  throw error;
}

function reportMissingOptionalDependency(name, expectedAsset) {
  window.IMErrorReporter?.reportRecoverable(
    `Optional homepage dependency ${name} is unavailable; its enhancements were skipped.`,
    {
      kind: "dependency",
      source: new URL(expectedAsset, document.baseURI).href,
      context: { dependency: name, expectedAsset },
    },
  );
}

const homeConfig = window.IMHomeConfig || {};
const API_ROOT = homeConfig.apiRoot || "https://sajidmohd717.github.io/series-api";
const CATALOG_VERSION = homeConfig.catalogVersion || "1";
const AI_SEARCH_ENDPOINT = homeConfig.aiSearchEndpoint || "";

const homeUtils = requireHomeDependency("IMUtils", "scripts/utils.js");
const {
  escapeHtml,
  formatDuration,
  getAllSeries,
  seriesUrl,
} = homeUtils;

const homeData = requireHomeDependency("IMHomeData", "scripts/home-data.js");
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
} = homeData;

const homeCardActions = requireHomeDependency("IMCardActions", "scripts/home-card-actions.js");
const { toggleSavedSeries, shareSeries, closeCardMenu } = homeCardActions;

const noOpShelfRenderer = () => {};
const homeShelves = window.IMHomeShelves;
if (!homeShelves) {
  reportMissingOptionalDependency("IMHomeShelves", "scripts/home-shelves.js");
}
const {
  renderContinueWatching = noOpShelfRenderer,
  renderStudyStreak = noOpShelfRenderer,
} = homeShelves || {};

const homeCategoryNavModule = requireHomeDependency(
  "IMHomeCategoryNav",
  "scripts/home-category-nav.js",
);
const homeSearchModule = requireHomeDependency("IMHomeSearch", "scripts/home-search.js");
const homeGridModule = requireHomeDependency("IMHomeGrid", "scripts/home-grid.js");
const homeSearchResultsModule = requireHomeDependency(
  "IMHomeSearchResults",
  "scripts/home-search-results.js",
);

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
  categoryScrollPrevious: document.querySelector("#category-scroll-previous"),
  categoryScrollNext: document.querySelector("#category-scroll-next"),
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

const categoryNav = homeCategoryNavModule.create({ state, els, categories, escapeHtml });

function searchCatalog() {
  return uniqueBy(
    flattenSeries(mergeLocalSeries(state.sections, "foryou")).filter(isAllowedSeries),
    searchItemId,
  );
}

function searchItemId(item) {
  return `${item.contentType || "series"}:${getSeriesUrl(item)}:${item.title}`.toLowerCase();
}

let grid;
let searchResults;
const homeSearch = homeSearchModule.create({
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
    grid.resetPagination();
    grid.render();
    searchResults.runEpisode(query);
    searchResults.runTranscript(query);
    if (query) {
      grid.scrollToResults();
      searchResults.log(query);
      searchResults.runAi(query);
    }
  },
});

function getSeriesUrl(series) {
  if (series.contentType === "video") return series.link;
  const local = getAllSeries().find(s => s.title === series.title);
  if (local) return seriesUrl(local);
  return series.link;
}

grid = homeGridModule.create({
  state,
  els,
  batchSize: catalogBatchSize,
  categories,
  getSearchSections: searchSections,
  itemId: searchItemId,
  getItemUrl: getSeriesUrl,
  homeSearch,
});

searchResults = homeSearchResultsModule.create({
  state,
  endpoint: AI_SEARCH_ENDPOINT,
  categoryNameMap,
  escapeHtml,
  formatDuration,
  catalog: searchCatalog,
  itemId: searchItemId,
  onResultsChanged: grid.render,
});

if (els.searchInput && state.searchTerm) els.searchInput.value = state.searchTerm;

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
  grid.resetPagination();
  state.aiSearch = preserveSearch
    ? { query: state.searchTerm, pending: Boolean(state.searchTerm && AI_SEARCH_ENDPOINT), results: null, reasonById: {}, scoreById: {}, message: "" }
    : { query: "", pending: false, results: null, reasonById: {}, scoreById: {}, message: "" };
  if (!preserveSearch) {
    homeSearch.reset();
    searchResults.clearSecondary();
  }
  categoryNav.render();
  grid.showSkeletons(6);

  if (localFirstCategories.has(category)) {
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category]), category);
    grid.render();
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
    grid.setStatus(
      `Live data could not be loaded, so a saved starter collection is shown. <button class="retry-button" type="button">Retry</button>`,
    );
  }

  grid.render();
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

  els.categoryScrollPrevious?.addEventListener("click", () => categoryNav.scroll(-1));
  els.categoryScrollNext?.addEventListener("click", () => categoryNav.scroll(1));
  els.categoryList.addEventListener("scroll", categoryNav.updateScrollButtons, { passive: true });
  window.addEventListener("resize", categoryNav.updateScrollButtons);

  els.contentTypeFilter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-content-type]");
    if (!button) return;
    state.contentType = button.dataset.contentType;
    grid.resetPagination();
    els.contentTypeFilter.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    grid.render();
  });

  function syncHideWatchedBtn() {
    if (!els.hideWatchedBtn) return;
    els.hideWatchedBtn.setAttribute("aria-pressed", String(state.hideWatched));
    els.hideWatchedBtn.classList.toggle("is-active", state.hideWatched);
    els.hideWatchedBtn.querySelector("span").textContent = state.hideWatched ? "Show watched" : "Hide watched";
  }

  els.hideWatchedBtn?.addEventListener("click", () => {
    state.hideWatched = !state.hideWatched;
    grid.resetPagination();
    localStorage.setItem("im-hide-watched", state.hideWatched);
    syncHideWatchedBtn();
    grid.render();
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

    const card = event.target.closest(".series-card");
    if (card && !event.target.closest("a, button, .card-menu")) {
      card.querySelector(".series-link")?.click();
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
    grid.resetPagination();
    els.sortDisplay.textContent = sortLabels[value] || value;
    els.sortOptions.querySelectorAll(".sort-option").forEach((o) => {
      o.classList.toggle("is-selected", o === option);
      o.setAttribute("aria-selected", String(o === option));
    });
    els.sortOptions.hidden = true;
    els.sortTrigger.setAttribute("aria-expanded", "false");
    grid.render();
  });

  els.catalogLoadMore?.addEventListener("click", () => {
    const previouslyShown = els.seriesGrid.querySelectorAll(".series-card").length;
    state.visibleCount += catalogBatchSize;
    grid.render();
    // Query inside the frame callback: a re-render landing between click and
    // rAF (for example, a remote feed merge) can replace the card nodes, and
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

categoryNav.render();
renderContinueWatching();
renderStudyStreak();
bindEvents();
loadCategory(state.activeCategory, { preserveSearch: Boolean(state.searchTerm) }).then(() => {
  if (!state.searchTerm) return;
  searchResults.runEpisode(state.searchTerm);
  searchResults.runTranscript(state.searchTerm);
  searchResults.runAi(state.searchTerm);
});

window.addEventListener("popstate", () => {
  const query = searchFromUrl();
  state.searchTerm = query;
  state.aiSearch = { query, pending: Boolean(query && AI_SEARCH_ENDPOINT), results: null, reasonById: {}, scoreById: {}, message: "" };
  grid.resetPagination();
  if (els.searchInput) els.searchInput.value = query;
  grid.render();
  searchResults.runEpisode(query);
  searchResults.runTranscript(query);
  if (query) searchResults.runAi(query);
});

els.continueList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".continue-remove");
  if (!btn) return;
  const card = btn.closest("[data-progress-key]");
  if (!card) return;
  try { localStorage.removeItem(card.dataset.progressKey); } catch {}
  renderContinueWatching();
  renderStudyStreak();
  grid.render();
});

window.addEventListener("im-auth-state-changed", () => {
  renderContinueWatching();
  renderStudyStreak();
  grid.render();
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
