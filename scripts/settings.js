const STORAGE_PREFIX = "lecture-progress:";

const summary = document.querySelector("#watch-history-summary");
const status = document.querySelector("#settings-status");
const resetButton = document.querySelector("#reset-watch-history");
const savedSummary = document.querySelector("#saved-items-summary");
const savedList = document.querySelector("#saved-items-list");
const resetSavedButton = document.querySelector("#reset-saved-items");
const SAVED_KEY = "improving-muslim:saved-items";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function progressKeys() {
  const keys = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
  } catch {
    return keys;
  }
  return keys;
}

function readProgressItems() {
  return progressKeys().map((key) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch (error) {
      return {};
    }
  });
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
  keys.forEach((key) => localStorage.removeItem(key));
  if (status) status.textContent = "Watch history has been reset on this device.";
  renderSummary();
});

renderSummary();

function readSavedItems() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
  } catch {
    return [];
  }
}

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
  try {
    localStorage.removeItem(SAVED_KEY);
  } catch {
    // Ignore storage failures; renderSavedItems will show the current state.
  }
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
    themeSelect.value = localStorage.getItem(SETTINGS_THEME_KEY) || "system";
  } catch {
    themeSelect.value = "system";
  }

  themeSelect.addEventListener("change", () => {
    const selectedTheme = ["light", "dark"].includes(themeSelect.value) ? themeSelect.value : "system";
    try {
      localStorage.setItem(SETTINGS_THEME_KEY, selectedTheme);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = selectedTheme;
  });
}
