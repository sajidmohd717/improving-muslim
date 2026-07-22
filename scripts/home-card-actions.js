/*
 * Homepage card actions: the save/share buttons inside each grid card's
 * "More options" menu, and the menu open/close bookkeeping. Exposes
 * window.IMCardActions. script.js owns the event delegation and calls in.
 *
 * Loaded on the homepage after content-actions.js and before script.js.
 */
(() => {
  "use strict";

  const { isSaved, toggleSaved, shareContent } = window.IMContentActions;

  function savedSeriesItem(series, url) {
    return {
      key: `${series.contentType === "video" ? "video" : "series"}:${url}`,
      type: series.contentType === "video" ? "video" : "series",
      title: series.title,
      subtitle: [series.speaker, series.episodes].filter(Boolean).join(" - "),
      url,
      savedAt: Date.now(),
    };
  }

  function isSeriesSaved(url) {
    return isSaved([`series:${url}`, `video:${url}`]);
  }

  function updateSeriesSaveButton(button, saved) {
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", saved ? "Remove saved series" : "Save series");
    const span = button.querySelector("span");
    if (span) span.textContent = saved ? "Saved" : "Save";
  }

  function closeCardMenu(menu) {
    if (!menu) return;
    menu.hidden = true;
    const trigger = menu.previousElementSibling;
    if (trigger?.classList.contains("card-menu-trigger")) {
      trigger.setAttribute("aria-expanded", "false");
    }
    menu.closest(".series-card")?.style.removeProperty("z-index");
  }

  function toggleSavedSeries(series, url, button) {
    const item = savedSeriesItem(series, url);
    const result = toggleSaved(item);
    if (!result.ok) {
      button.setAttribute("aria-label", "Could not save series");
      return;
    }
    updateSeriesSaveButton(button, result.saved);
  }

  async function shareSeries(series, url, button) {
    const absoluteUrl = new URL(url, document.baseURI).href;
    try {
      const method = await shareContent({
        title: series.title,
        text: [series.title, series.speaker].filter(Boolean).join(" by "),
        url: absoluteUrl,
      });
      if (method === "copied") {
        button.setAttribute("aria-label", "Series link copied");
        setTimeout(() => {
          button.setAttribute("aria-label", "Share series");
        }, 1800);
      }
    } catch {
      button.setAttribute("aria-label", "Could not share series");
    }
  }

  window.IMCardActions = {
    isSeriesSaved,
    toggleSavedSeries,
    shareSeries,
    closeCardMenu,
  };
})();
