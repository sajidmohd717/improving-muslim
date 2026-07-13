const {
  PROGRESS_PREFIX,
  NOTES_PREFIX,
  SAVED_KEY,
  STREAK_KEY,
  escapeHtml,
  readJsonStorage,
  readSavedItems,
  readStudyStreak,
  removeStorageItem,
  getStreakRank,
  storageKeysWithPrefix,
} = window.IMUtils;

const summary = document.querySelector("#watch-history-summary");
const status = document.querySelector("#settings-status");
const resetButton = document.querySelector("#reset-watch-history");
const savedSummary = document.querySelector("#saved-items-summary");
const savedList = document.querySelector("#saved-items-list");
const resetSavedButton = document.querySelector("#reset-saved-items");
const streakSummary = document.querySelector("#streak-settings-summary");

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
  const rank = getStreakRank ? getStreakRank(streak.current) : null;
  const rankNote = rank ? ` ${rank.name} rank.` : "";

  streakSummary.textContent = complete
    ? `Today's ${streak.targetMinutes} minute goal is complete. Current streak: ${streak.current} ${streak.current === 1 ? "day" : "days"}.${rankNote}`
    : `${watchedMinutes} of ${streak.targetMinutes} minutes watched today. ${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"} left to keep the streak.${rankNote}`;
}

renderStreakSettings();

function renderSavedItems() {
  const items = readSavedItems();

  if (!savedSummary || !savedList || !resetSavedButton) {
    return;
  }

  const location = window.IMAuth?.currentUser ? "in your account" : "on this device";

  if (!items.length) {
    savedSummary.textContent = `No saved items ${location} yet.`;
    savedList.innerHTML = "";
    resetSavedButton.disabled = true;
    return;
  }

  savedSummary.textContent = `${items.length} saved ${items.length === 1 ? "item" : "items"} ${location}.`;
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

const cloudResetSection = document.querySelector("#cloud-reset-section");
const cloudResetButton = document.querySelector("#reset-cloud-data");

function renderCloudResetVisibility() {
  if (!cloudResetSection) return;
  const signedIn = Boolean(window.IMAuth?.currentUser);
  cloudResetSection.hidden = !signedIn;
  const localProgressSection = document.querySelector("#local-progress-section");
  if (localProgressSection) localProgressSection.hidden = signedIn;
}

cloudResetButton?.addEventListener("click", () => {
  if (!window.IMAuth?.currentUser) return;
  const confirmed = confirm(
    "This permanently erases your synced watch history, notes, saved items, streak, and leaderboard entry from your account and this device. This cannot be undone. Continue?",
  );
  if (!confirmed) return;

  cloudResetButton.disabled = true;
  if (status) status.textContent = "Resetting account data...";

  window.IMAuth.resetCloudData()
    .then(() => {
      if (status) status.textContent = "Account data has been reset.";
      renderSummary();
      renderSavedItems();
      renderStreakSettings();
    })
    .catch((err) => {
      console.warn("[Settings] Cloud reset failed:", err.message);
      if (status) status.textContent = "Could not reset account data. Please try again.";
    })
    .finally(() => {
      cloudResetButton.disabled = false;
    });
});

renderCloudResetVisibility();

window.addEventListener("im-auth-state-changed", () => {
  renderSummary();
  renderSavedItems();
  renderStreakSettings();
  renderCloudResetVisibility();
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
