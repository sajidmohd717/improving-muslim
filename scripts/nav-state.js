(function () {
const LAST_SERIES_KEY = "improving-muslim:last-series-url";
const DEFAULT_SERIES_URL = "./pages/series.html";

function normalizeSeriesUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
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
if (window.location.pathname.includes('/pages/')) {
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

/* Mark the active link in the desktop site-menu */
const siteMenu = document.querySelector('.site-menu');
if (siteMenu) {
  const currentPage = window.location.pathname.split('/').pop().split('?')[0];
  siteMenu.querySelectorAll('a[href]').forEach((link) => {
    const linkPage = link.getAttribute('href').split('/').pop().split('?')[0];
    if (linkPage && linkPage === currentPage) {
      link.classList.add('is-active');
    }
  });
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

/* Inject Saved link into bottom nav after History */
const bottomNav = document.querySelector('.bottom-nav');
if (bottomNav) {
  const historyItem = bottomNav.querySelector('a[href*="history.html"]');
  if (historyItem) {
    const isSavedPage = window.location.pathname.endsWith('saved.html');
    const savedLink = document.createElement('a');
    savedLink.className = 'bottom-nav-item' + (isSavedPage ? ' is-active' : '');
    savedLink.href = './pages/saved.html';
    savedLink.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
      '<span>Saved</span>';
    historyItem.insertAdjacentElement('afterend', savedLink);
  }
}

/* Inject Speakers link into bottom nav between History and Settings */
if (bottomNav) {
  const historyItem = bottomNav.querySelector('a[href*="history.html"]');
  if (historyItem) {
    const isActive = window.location.pathname.endsWith('speakers.html');
    const a = document.createElement('a');
    a.className = 'bottom-nav-item' + (isActive ? ' is-active' : '');
    a.href = './pages/speakers.html';
    a.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
      '</svg>' +
      '<span>Speakers</span>';
    historyItem.insertAdjacentElement('afterend', a);
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (href && href.startsWith("./pages/series-") && href.endsWith(".html")) {
    saveLastSeriesUrl(href);
  }
});
})();
