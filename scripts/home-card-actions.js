/*
 * Homepage card actions: the save/share buttons inside each grid card's
 * "More options" menu, and the menu open/close bookkeeping. Exposes
 * window.IMCardActions. script.js owns the event delegation and calls in.
 *
 * Loaded on the homepage after utils.js and before script.js.
 */
(() => {
  "use strict";

  const { readSavedItems, writeSavedItems } = window.IMUtils;

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
    return readSavedItems().some((item) => item.key === `series:${url}` || item.key === `video:${url}`);
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
    const items = readSavedItems();
    const existing = items.findIndex((saved) => saved.key === item.key);
    const nextItems =
      existing >= 0
        ? items.filter((saved) => saved.key !== item.key)
        : [item, ...items.filter((saved) => saved.key !== item.key)].slice(0, 60);

    if (!writeSavedItems(nextItems)) {
      button.setAttribute("aria-label", "Could not save series");
      return;
    }

    const saved = existing < 0;
    updateSeriesSaveButton(button, saved);
  }

  async function shareSeries(series, url, button) {
    const absoluteUrl = new URL(url, document.baseURI).href;
    const shareData = {
      title: series.title,
      text: [series.title, series.speaker].filter(Boolean).join(" by "),
      url: absoluteUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(absoluteUrl);
      button.setAttribute("aria-label", "Series link copied");
      setTimeout(() => {
        button.setAttribute("aria-label", "Share series");
      }, 1800);
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
