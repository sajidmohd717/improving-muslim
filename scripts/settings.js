const STORAGE_PREFIX = "lecture-progress:";

const summary = document.querySelector("#watch-history-summary");
const status = document.querySelector("#settings-status");
const resetButton = document.querySelector("#reset-watch-history");

function progressKeys() {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
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
  status.textContent = "Watch history has been reset on this device.";
  renderSummary();
});

renderSummary();

const AUTOPLAY_KEY = "improving-muslim:autoplay-next";
const autoplayToggle = document.querySelector("#autoplay-toggle");
if (autoplayToggle) {
  autoplayToggle.checked = localStorage.getItem(AUTOPLAY_KEY) === "on";
  autoplayToggle.addEventListener("change", () => {
    try { localStorage.setItem(AUTOPLAY_KEY, autoplayToggle.checked ? "on" : "off"); }
    catch { /* ignore */ }
  });
}
