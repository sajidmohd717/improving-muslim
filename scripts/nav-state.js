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

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (href && href.startsWith("./pages/series-") && href.endsWith(".html")) {
    saveLastSeriesUrl(href);
  }
});
})();
