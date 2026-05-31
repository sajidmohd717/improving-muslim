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

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (href && href.startsWith("./pages/series-") && href.endsWith(".html")) {
    saveLastSeriesUrl(href);
  }
});
