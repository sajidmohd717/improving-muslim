const {
  escapeHtml,
  formatDuration,
  PROGRESS_PREFIX,
  readJsonStorage,
  removeStorageItem,
  storageKeysWithPrefix,
} = window.IMUtils;

const { progressItem } = window.IMCatalogLookup;

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

      const catalogItem = progressItem(playlistId, episodeId);
      if (!catalogItem) continue;
      items.push({
        key,
        currentTime,
        duration,
        percent,
        updatedAt,
        thumb: catalogItem.thumb,
        url: catalogItem.url,
        eyebrow: catalogItem.kind === "standalone"
          ? `${catalogItem.speaker} — Standalone video`
          : `${catalogItem.seriesTitle} — Episode ${catalogItem.number}`,
        title: catalogItem.title,
      });
    }
  } catch {}

  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

function relativeTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(ts));
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
    .map(({ key, currentTime, percent, updatedAt, thumb, url, eyebrow, title }) => {
      const pct = Math.round(percent * 100);
      const completed = percent > 0.97;
      const when = relativeTime(updatedAt);

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
              <span class="history-when">${escapeHtml(when)}</span>
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
  const destination = window.IMAuth?.currentUser ? "your account and synced devices" : "this device";
  if (!confirm(`Remove all watch history from ${destination}?`)) return;
  storageKeysWithPrefix(PROGRESS_PREFIX).forEach(removeStorageItem);
  renderHistory();
});

function updateStorageNote() {
  const note = document.getElementById("storage-note");
  const eyebrow = document.getElementById("history-eyebrow");
  if (!note) return;
  const user = window.IMAuth?.currentUser;
  if (user) {
    const status = window.IMAuth?.syncStatus || "connecting";
    const copy = {
      connecting: ["Connecting", "Connecting to your account…"],
      syncing: ["Syncing", "Saving your latest changes…"],
      offline: ["Saved offline", "Saved on this device. It will sync when your connection returns."],
      synced: ["Cloud synced", "Synced across your devices."],
    }[status] || ["Cloud synced", "Synced across your devices."];
    if (eyebrow) eyebrow.textContent = copy[0];
    note.textContent = copy[1];
  } else {
    note.textContent = "Stored locally — only visible on this device.";
    if (eyebrow) eyebrow.textContent = "On this device";
  }
}

window.addEventListener("im-auth-state-changed", () => { renderHistory(); updateStorageNote(); });

renderHistory();
updateStorageNote();
