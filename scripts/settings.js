const {
  PROGRESS_PREFIX,
  SAVED_KEY,
  escapeHtml,
  readJsonStorage,
  readSavedItems,
  removeStorageItem,
  storageKeysWithPrefix,
} = window.IMUtils;

const summary = document.querySelector("#watch-history-summary");
const status = document.querySelector("#settings-status");
const resetButton = document.querySelector("#reset-watch-history");
const savedSummary = document.querySelector("#saved-items-summary");
const savedList = document.querySelector("#saved-items-list");
const resetSavedButton = document.querySelector("#reset-saved-items");

function progressKeys() {
  return storageKeysWithPrefix(PROGRESS_PREFIX);
}

function readProgressItems() {
  return progressKeys().map((key) => readJsonStorage(key, {}));
}

function renderSummary() {
  if (!summary || !resetButton) {
    return;
  }

  const items = readProgressItems();
  const completed = items.filter((item) => item.completed).length;
  const inProgress = items.filter((item) => !item.completed).length;

  if (!items.length) {
    summary.textContent = "No watch history is stored on this device yet.";
    resetButton.disabled = true;
    return;
  }

  summary.textContent = `${items.length} saved ${items.length === 1 ? "episode" : "episodes"} on this device: ${completed} watched, ${inProgress} in progress.`;
  resetButton.disabled = false;
}

resetButton.addEventListener("click", () => {
  const keys = progressKeys();
  keys.forEach(removeStorageItem);
  if (status) status.textContent = "Watch history has been reset on this device.";
  renderSummary();
});

renderSummary();

function renderSavedItems() {
  const items = readSavedItems();

  if (!savedSummary || !savedList || !resetSavedButton) {
    return;
  }

  if (!items.length) {
    savedSummary.textContent = "No saved items on this device yet.";
    savedList.innerHTML = "";
    resetSavedButton.disabled = true;
    return;
  }

  savedSummary.textContent = `${items.length} saved ${items.length === 1 ? "item" : "items"} on this device.`;
  resetSavedButton.disabled = false;
  savedList.innerHTML = items
    .map(
      (item) => `
        <a class="saved-item" href="${escapeHtml(item.url)}">
          <span>${item.type === "episode" ? "Episode" : "Series"}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <em>${escapeHtml(item.subtitle || "")}</em>
        </a>
      `,
    )
    .join("");
}

resetSavedButton?.addEventListener("click", () => {
  removeStorageItem(SAVED_KEY);
  if (status) status.textContent = "Saved items have been cleared on this device.";
  renderSavedItems();
});

renderSavedItems();

const AUTOPLAY_KEY = "improving-muslim:autoplay-next";
const autoplayToggle = document.querySelector("#autoplay-toggle");
if (autoplayToggle) {
  autoplayToggle.checked = localStorage.getItem(AUTOPLAY_KEY) === "on";
  autoplayToggle.addEventListener("change", () => {
    try { localStorage.setItem(AUTOPLAY_KEY, autoplayToggle.checked ? "on" : "off"); }
    catch { /* ignore */ }
  });
}

const themeSelect = document.querySelector("#theme-select");
const SETTINGS_THEME_KEY = "improving-muslim:theme";
if (themeSelect) {
  try {
    const savedTheme = localStorage.getItem(SETTINGS_THEME_KEY);
    themeSelect.value = savedTheme === "dark" ? "dark" : "light";
  } catch {
    themeSelect.value = "light";
  }

  themeSelect.addEventListener("change", () => {
    const selectedTheme = themeSelect.value === "dark" ? "dark" : "light";
    try {
      localStorage.setItem(SETTINGS_THEME_KEY, selectedTheme);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = selectedTheme;
  });
}
