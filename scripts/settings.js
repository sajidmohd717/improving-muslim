const {
  PROGRESS_PREFIX,
  SAVED_KEY,
  escapeHtml,
  readJsonStorage,
  readSavedItems,
  readStudyStreak,
  removeStorageItem,
  setStudyStreakTarget,
  STREAK_TARGET_OPTIONS,
  storageKeysWithPrefix,
} = window.IMUtils;

const summary = document.querySelector("#watch-history-summary");
const status = document.querySelector("#settings-status");
const resetButton = document.querySelector("#reset-watch-history");
const savedSummary = document.querySelector("#saved-items-summary");
const savedList = document.querySelector("#saved-items-list");
const resetSavedButton = document.querySelector("#reset-saved-items");
const streakSummary = document.querySelector("#streak-settings-summary");
const streakTargetInputs = Array.from(document.querySelectorAll('input[name="streak-target"]'));

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

function renderStreakSettings() {
  if (!streakSummary || !readStudyStreak) {
    return;
  }

  const streak = readStudyStreak();
  const targetSeconds = streak.targetMinutes * 60;
  const todaySeconds = Math.min(streak.todaySeconds, targetSeconds);
  const watchedMinutes = Math.floor(todaySeconds / 60);
  const remainingMinutes = Math.max(0, Math.ceil((targetSeconds - todaySeconds) / 60));
  const complete = todaySeconds >= targetSeconds;

  streakSummary.textContent = complete
    ? `Today's ${streak.targetMinutes} minute goal is complete. Current streak: ${streak.current} ${streak.current === 1 ? "day" : "days"}.`
    : `${watchedMinutes} of ${streak.targetMinutes} minutes watched today. ${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"} left to keep the streak.`;

  streakTargetInputs.forEach((input) => {
    input.checked = Number(input.value) === streak.targetMinutes;
  });
}

streakTargetInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked || !STREAK_TARGET_OPTIONS.includes(Number(input.value))) return;
    if (setStudyStreakTarget(Number(input.value))) {
      if (status) status.textContent = `Daily streak goal set to ${input.value} minutes.`;
      renderStreakSettings();
    }
  });
});

renderStreakSettings();

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

window.addEventListener("im-auth-state-changed", () => {
  renderSummary();
  renderSavedItems();
  renderStreakSettings();
});

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
    themeSelect.value = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "system";
  } catch {
    themeSelect.value = "system";
  }

  themeSelect.addEventListener("change", () => {
    const selectedTheme = ["dark", "light", "system"].includes(themeSelect.value)
      ? themeSelect.value
      : "system";
    if (window.improvingMuslimTheme) {
      window.improvingMuslimTheme.set(selectedTheme);
      return;
    }
    try {
      localStorage.setItem(SETTINGS_THEME_KEY, selectedTheme);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = selectedTheme === "dark" ? "dark" : "light";
  });
}
