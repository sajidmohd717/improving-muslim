const {
  escapeHtml,
  readSavedItems,
  writeSavedItems,
  getSeriesRegistry,
  episodeThumbnailUrl,
} = window.IMUtils;

const list = document.getElementById("saved-list");
const emptyState = document.getElementById("saved-empty");
const clearBtn = document.getElementById("clear-saved-btn");

function typeLabel(type) {
  if (type === "episode") return "Episode";
  if (type === "video") return "Video";
  return "Series";
}

function getThumbnail(item) {
  try {
    const registry = getSeriesRegistry();
    if (item.type === "series" || item.type === "video") {
      const series = Object.values(registry).find((s) =>
        item.url.includes(s.slug)
      );
      return series?.thumbnailSrc || null;
    }
    if (item.type === "episode") {
      const params = new URLSearchParams(item.url.split("?")[1] || "");
      const slug = params.get("series");
      const videoId = params.get("video");
      const series = registry[slug];
      if (series && videoId) {
        const episode = series.episodes.find((e) => String(e.id) === videoId);
        if (episode) return episodeThumbnailUrl(series, episode);
      }
      return series?.thumbnailSrc || null;
    }
  } catch {
    return null;
  }
  return null;
}

function renderSaved() {
  if (!list) return;
  const items = readSavedItems().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  if (!items.length) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  emptyState?.setAttribute("hidden", "");
  if (clearBtn) clearBtn.hidden = false;

  list.innerHTML = items
    .map((item) => {
      const thumb = getThumbnail(item);
      return `
      <div class="saved-item" data-key="${escapeHtml(item.key)}">
        <a class="saved-item-link" href="${escapeHtml(item.url)}">
          ${thumb ? `<div class="saved-item-thumb"><img src="${escapeHtml(thumb)}" alt="" loading="lazy" /></div>` : ""}
          <div class="saved-item-info">
            <span class="saved-item-type">${typeLabel(item.type)}</span>
            <strong class="saved-item-title">${escapeHtml(item.title)}</strong>
            <span class="saved-item-subtitle">${escapeHtml(item.subtitle || "")}</span>
          </div>
        </a>
        <button class="history-remove" type="button" aria-label="Remove from saved">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
    })
    .join("");
}

list?.addEventListener("click", (e) => {
  const btn = e.target.closest(".history-remove");
  if (!btn) return;
  const item = btn.closest("[data-key]");
  if (!item) return;
  const remaining = readSavedItems().filter((s) => s.key !== item.dataset.key);
  writeSavedItems(remaining);
  renderSaved();
});

clearBtn?.addEventListener("click", () => {
  if (!confirm("Remove all saved items on this device?")) return;
  writeSavedItems([]);
  renderSaved();
});

window.addEventListener("im-auth-state-changed", renderSaved);

renderSaved();
