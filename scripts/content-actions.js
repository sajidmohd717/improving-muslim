/*
 * Shared saved-item and Web Share operations used by homepage, series, watch,
 * and saved-item surfaces. Domain-specific callers still build their own item
 * metadata and own their user-facing status copy.
 */
(() => {
  "use strict";

  const { readSavedItems, writeSavedItems } = window.IMUtils;
  const MAX_SAVED_ITEMS = 60;

  function currentItems() {
    const items = readSavedItems();
    return Array.isArray(items) ? items : [];
  }

  function isSaved(keys) {
    const accepted = new Set(Array.isArray(keys) ? keys : [keys]);
    return currentItems().some((item) => accepted.has(item?.key));
  }

  function toggleSaved(item, limit = MAX_SAVED_ITEMS) {
    if (!item?.key) return { ok: false, saved: false };
    const items = currentItems();
    const wasSaved = items.some((saved) => saved?.key === item.key);
    const withoutItem = items.filter((saved) => saved?.key !== item.key);
    const nextItems = wasSaved ? withoutItem : [item, ...withoutItem].slice(0, limit);
    const ok = writeSavedItems(nextItems);
    return { ok, saved: ok ? !wasSaved : wasSaved };
  }

  function removeSaved(key) {
    if (!key) return false;
    return writeSavedItems(currentItems().filter((item) => item?.key !== key));
  }

  function clearSaved() {
    return writeSavedItems([]);
  }

  async function shareContent({ title, text, url }) {
    const shareData = { title, text, url };
    if (navigator.share) {
      await navigator.share(shareData);
      return "shared";
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
    throw new Error("Sharing is unavailable in this browser.");
  }

  window.IMContentActions = {
    MAX_SAVED_ITEMS,
    isSaved,
    toggleSaved,
    removeSaved,
    clearSaved,
    shareContent,
  };
})();
