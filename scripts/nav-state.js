(function () {
const LAST_SERIES_KEY = "improving-muslim:last-series-url";
const DEFAULT_SERIES_URL = "./pages/series.html";

function normalizeSeriesUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    const seriesMatch = parsed.pathname.match(/\/series\/([^/]+)\/?$/);
    if (seriesMatch) return `./series/${seriesMatch[1]}/`;
    if (parsed.pathname.endsWith("/pages/series-detail.html")) {
      const id = parsed.searchParams.get("id");
      return id ? `./series/${encodeURIComponent(id)}/` : DEFAULT_SERIES_URL;
    }
    const page = parsed.pathname.split("/").pop();
    return page.startsWith("series-") && page.endsWith(".html") ? `./pages/${page}` : DEFAULT_SERIES_URL;
  } catch (error) {
    return DEFAULT_SERIES_URL;
  }
}

function saveLastSeriesUrl(url) {
  try {
    localStorage.setItem(LAST_SERIES_KEY, normalizeSeriesUrl(url));
  } catch (error) {
    return;
  }
}

function readLastSeriesUrl() {
  try {
    return localStorage.getItem(LAST_SERIES_KEY) || DEFAULT_SERIES_URL;
  } catch (error) {
    return DEFAULT_SERIES_URL;
  }
}

function currentSeriesUrl() {
  const seriesMatch = window.location.pathname.match(/\/series\/([^/]+)\/?$/);
  if (seriesMatch) {
    return `./series/${seriesMatch[1]}/`;
  }

  if (window.location.pathname.endsWith("/pages/series-detail.html")) {
    const id = new URLSearchParams(window.location.search).get("id");
    return id ? `./series/${encodeURIComponent(id)}/` : "";
  }

  const page = window.location.pathname.split("/").pop();
  if (page.startsWith("series-") && page.endsWith(".html")) {
    return `./pages/${page}`;
  }

  const currentWatchSeriesLink = document.querySelector("#bottom-nav-series-link");
  return currentWatchSeriesLink?.getAttribute("href") || "";
}

const seriesUrl = currentSeriesUrl();
if (seriesUrl) {
  saveLastSeriesUrl(seriesUrl);
}

document.querySelectorAll(".js-last-series-link").forEach((link) => {
  link.href = readLastSeriesUrl();
});

/* Inject a back button on inner pages for mobile users */
if (window.location.pathname.includes('/pages/') || window.location.pathname.includes('/series/') || window.location.pathname.includes('/watch/')) {
  const navShell = document.querySelector('.nav-shell');
  if (navShell) {
    const btn = document.createElement('button');
    btn.className = 'back-button';
    btn.setAttribute('aria-label', 'Go back');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
    btn.addEventListener('click', function () {
      window.history.back();
    });
    navShell.insertBefore(btn, navShell.firstChild);
  }
}

/* Mark the active destination in both desktop navigation treatments. */
const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
document.querySelectorAll('.site-menu, .desktop-sidebar').forEach((navigation) => {
  navigation.querySelectorAll('a[href]').forEach((link) => {
    const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
    if (linkPage && linkPage === currentPage) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });
});

/* Preserve a homepage search query in the shared desktop search field. */
const desktopSearch = document.querySelector('#desktop-site-search');
if (desktopSearch && currentPage === 'index.html') {
  desktopSearch.value = new URLSearchParams(window.location.search).get('q') || '';
}

/* Inject settings gear icon into header before the More button */
const navMore = document.querySelector('.nav-more');
if (navMore) {
  const isSettingsPage = window.location.pathname.endsWith('settings.html');
  const settingsLink = document.createElement('a');
  settingsLink.className = 'nav-settings-link' + (isSettingsPage ? ' is-active' : '');
  settingsLink.href = './pages/settings.html';
  settingsLink.setAttribute('aria-label', 'Settings');
  settingsLink.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    '</svg>';
  navMore.insertAdjacentElement('afterbegin', settingsLink);
}

/* Mark the active link in the bottom nav */
const bottomNav = document.querySelector('.bottom-nav');
if (bottomNav) {
  bottomNav.querySelectorAll('a[href]').forEach((link) => {
    const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
    if (linkPage && linkPage === currentPage) {
      link.classList.add('is-active');
    }
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (
    href &&
    ((href.startsWith("./pages/series-") && href.endsWith(".html")) || href.startsWith("./series/"))
  ) {
    saveLastSeriesUrl(href);
  }
});
})();
