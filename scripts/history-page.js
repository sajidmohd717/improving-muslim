const {
  escapeHtml,
  episodeThumbnailUrl,
  episodeUrl,
  formatDuration,
  getAllSeries,
  PROGRESS_PREFIX,
  readJsonStorage,
  removeStorageItem,
  storageKeysWithPrefix,
} = window.IMUtils;

const allSeries = getAllSeries();

function readAllHistory() {
  const items = [];
  try {
    for (const key of storageKeysWithPrefix(PROGRESS_PREFIX)) {
      const parts = key.split(":");
      const playlistId = parts[1];
      const episodeId = parts.slice(2).join(":");

      const raw = readJsonStorage(key, {});
      const currentTime = Number(raw.currentTime) || 0;
      const duration = Number(raw.duration) || 0;
      const percent = duration > 0 ? currentTime / duration : 0;
      const updatedAt = Number(raw.updatedAt) || 0;

      const series = allSeries.find((s) => s.playlistId === playlistId);
      if (!series) continue;
      const episode = series.episodes.find((e) => String(e.id) === episodeId);
      if (!episode) continue;

      items.push({ series, episode, key, currentTime, duration, percent, updatedAt });
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
    .map(({ series, episode, key, currentTime, percent }) => {
      const pct = Math.round(percent * 100);
      const completed = percent > 0.97;
      const thumb = episodeThumbnailUrl(series, episode);
      const url = episodeUrl(series, episode);

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
              <span class="history-series">${escapeHtml(series.title)}</span>
              <span class="history-ep-num">Episode ${episode.number}</span>
              <strong class="history-title">${escapeHtml(episode.title)}</strong>
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

renderHistory();
