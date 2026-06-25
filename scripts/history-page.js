const {
  escapeHtml,
  episodeThumbnailUrl,
  episodeUrl,
  formatDuration,
  getAllSeries,
  getStandaloneLectureRegistry,
  standaloneLectureThumbnailUrl,
  standaloneLectureUrl,
  PROGRESS_PREFIX,
  readJsonStorage,
  removeStorageItem,
  storageKeysWithPrefix,
} = window.IMUtils;

const allSeries = getAllSeries();
const standaloneRegistry = getStandaloneLectureRegistry();

function readAllHistory() {
  const items = [];
  try {
    for (const key of storageKeysWithPrefix(PROGRESS_PREFIX)) {
      const raw = readJsonStorage(key, {});
      const currentTime = Number(raw.currentTime) || 0;
      const duration = Number(raw.duration) || 0;
      if (!duration) continue;
      const percent = currentTime / duration;
      const updatedAt = Number(raw.updatedAt) || 0;

      // New saves: use _card display data saved by watch-page.js
      if (raw._card) {
        items.push({
          key,
          currentTime,
          duration,
          percent,
          updatedAt,
          thumb: raw._card.thumbnail,
          url: raw._card.url,
          eyebrow: raw._card.eyebrow,
          title: raw._card.title,
        });
        continue;
      }

      // Legacy saves: look up from data files
      const parts = key.split(":");
      const playlistId = parts[1];
      const episodeId = parts.slice(2).join(":");

      if (playlistId === "standalone") {
        // Old standalone save without _card
        const lecture = standaloneRegistry[episodeId];
        if (!lecture) continue;
        items.push({
          key,
          currentTime,
          duration,
          percent,
          updatedAt,
          thumb: standaloneLectureThumbnailUrl(lecture),
          url: standaloneLectureUrl(lecture),
          eyebrow: `${lecture.speaker} — Standalone video`,
          title: lecture.title,
        });
      } else {
        // Old series episode save without _card
        const series = allSeries.find((s) => s.playlistId === playlistId);
        if (!series) continue;
        const episode = series.episodes.find((e) => String(e.id) === episodeId);
        if (!episode) continue;
        items.push({
          key,
          currentTime,
          duration,
          percent,
          updatedAt,
          thumb: episodeThumbnailUrl(series, episode),
          url: episodeUrl(series, episode),
          eyebrow: `${series.title} — Episode ${episode.number}`,
          title: episode.title,
        });
      }
    }
  } catch {}

  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const emptyState = document.getElementById("history-empty");
  const clearBtn = document.getElementById("clear-history-btn");
  if (!list) return;

  const items = readAllHistory();

  if (!items.length) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  emptyState?.setAttribute("hidden", "");
  if (clearBtn) clearBtn.hidden = false;

  list.innerHTML = items
    .map(({ key, currentTime, percent, thumb, url, eyebrow, title }) => {
      const pct = Math.round(percent * 100);
      const completed = percent > 0.97;

      return `
        <div class="history-item" data-progress-key="${escapeHtml(key)}">
          <a class="history-item-link" href="${escapeHtml(url)}">
            <div class="history-thumb">
              <img src="${escapeHtml(thumb)}" alt="" loading="lazy" />
              <div class="history-progress-bar">
                <div class="history-progress-fill" style="width:${pct}%"></div>
              </div>
            </div>
            <div class="history-info">
              <span class="history-series">${escapeHtml(eyebrow)}</span>
              <strong class="history-title">${escapeHtml(title)}</strong>
              <span class="history-status ${completed ? "is-done" : ""}">
                ${completed ? "Completed" : `Resume at ${formatDuration(currentTime)}`}
              </span>
            </div>
          </a>
          <button class="history-remove" type="button" aria-label="Remove from history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    })
    .join("");
}

document.getElementById("history-list")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".history-remove");
  if (!btn) return;
  const item = btn.closest("[data-progress-key]");
  if (!item) return;
  removeStorageItem(item.dataset.progressKey);
  renderHistory();
});

document.getElementById("clear-history-btn")?.addEventListener("click", () => {
  if (!confirm("Remove all watch history on this device?")) return;
  storageKeysWithPrefix(PROGRESS_PREFIX).forEach(removeStorageItem);
  renderHistory();
});

function updateStorageNote() {
  const note = document.getElementById("storage-note");
  const eyebrow = document.getElementById("history-eyebrow");
  if (!note) return;
  const user = window.IMAuth?.currentUser;
  if (user) {
    note.textContent = "Synced across your devices.";
    if (eyebrow) eyebrow.textContent = "Cloud synced";
  } else {
    note.textContent = "Stored locally — only visible on this device.";
    if (eyebrow) eyebrow.textContent = "On this device";
  }
}

window.addEventListener("im-auth-state-changed", () => { renderHistory(); updateStorageNote(); });

renderHistory();
updateStorageNote();
