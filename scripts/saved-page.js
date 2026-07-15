const {
  escapeHtml,
  readSavedItems,
  writeSavedItems,
  getSeriesRegistry,
  getStandaloneLectureRegistry,
  episodeThumbnailUrl,
  standaloneLectureThumbnailUrl,
  readJsonStorage,
  PROGRESS_PREFIX,
  formatDuration,
} = window.IMUtils;

const list = document.getElementById("saved-list");
const emptyState = document.getElementById("saved-empty");
const clearBtn = document.getElementById("clear-saved-btn");

function getThumbnail(item) {
  try {
    const registry = getSeriesRegistry();
    if (item.type === "series") {
      const series = Object.values(registry).find((s) => item.url.includes(s.slug));
      return series?.thumbnailSrc || null;
    }
    if (item.type === "video") {
      const params = new URLSearchParams(item.url.split("?")[1] || "");
      const lectureId = params.get("lecture");
      if (lectureId) {
        const lecture = getStandaloneLectureRegistry()[lectureId];
        if (lecture) return standaloneLectureThumbnailUrl(lecture);
      }
      return null;
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
  } catch {}
  return null;
}

function getResumeTime(item) {
  if (item.type !== "episode") return null;
  try {
    const params = new URLSearchParams(item.url.split("?")[1] || "");
    const slug = params.get("series");
    const videoId = params.get("video");
    const registry = getSeriesRegistry();
    const series = registry[slug];
    if (!series || !videoId) return null;
    const key = `${PROGRESS_PREFIX}${series.playlistId}:${videoId}`;
    const p = readJsonStorage(key, {});
    const t = Number(p.currentTime) || 0;
    const d = Number(p.duration) || 0;
    if (!d || t < 10) return null;
    if (p.completed || t / d > 0.97) return "completed";
    return formatDuration(t);
  } catch {}
  return null;
}

const removeIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function renderSeriesCard(item, i) {
  const thumb = getThumbnail(item);
  const parts = (item.subtitle || "").split(" - ");
  const speaker = parts[0] || "";
  const epCount = parts[1] || "";
  return `
    <article class="saved-series-card reveal-anim" style="--reveal-delay:${i * 40}ms" data-key="${escapeHtml(item.key)}">
      <a class="saved-series-link" href="${escapeHtml(item.url)}">
        <div class="saved-series-thumb">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />` : ""}
        </div>
        <div class="saved-series-info">
          <strong class="saved-series-title">${escapeHtml(item.title)}</strong>
          <span class="saved-series-meta">${escapeHtml(speaker)}${epCount ? ` · ${escapeHtml(epCount)}` : ""}</span>
        </div>
      </a>
      <button class="saved-card-remove" type="button" aria-label="Remove from saved">${removeIcon}</button>
    </article>
  `;
}

function renderEpisodeItem(item, i) {
  const thumb = getThumbnail(item);
  const resume = getResumeTime(item);
  const parts = (item.subtitle || "").split(" - ");
  const seriesTitle = parts[0] || "";
  return `
    <div class="saved-ep-item reveal-anim" style="--reveal-delay:${i * 30}ms" data-key="${escapeHtml(item.key)}">
      <a class="saved-ep-link" href="${escapeHtml(item.url)}">
        <div class="saved-ep-thumb">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />` : ""}
        </div>
        <div class="saved-ep-info">
          <span class="saved-ep-series">${escapeHtml(seriesTitle || item.subtitle || "")}</span>
          <strong class="saved-ep-title">${escapeHtml(item.title)}</strong>
          ${resume === "completed"
            ? `<span class="saved-ep-status is-done">Watched</span>`
            : resume
            ? `<span class="saved-ep-status">▶ Continue at ${escapeHtml(resume)}</span>`
            : ""}
        </div>
      </a>
      <button class="saved-remove-btn" type="button" aria-label="Remove from saved">${removeIcon}</button>
    </div>
  `;
}

function renderGroup(heading, items, renderFn) {
  if (!items.length) return "";
  return `
    <div class="saved-group">
      <h2 class="saved-group-heading">${escapeHtml(heading)}</h2>
      <div class="saved-group-body">${items.map(renderFn).join("")}</div>
    </div>
  `;
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

  const seriesItems = items.filter((i) => i.type === "series");
  const episodeItems = items.filter((i) => i.type === "episode");
  const videoItems = items.filter((i) => i.type === "video");

  list.innerHTML = [
    renderGroup("Saved Series", seriesItems, renderSeriesCard),
    renderGroup("Saved Episodes", episodeItems, renderEpisodeItem),
    renderGroup("Short Videos", videoItems, renderEpisodeItem),
  ].join("");
}

list?.addEventListener("click", (e) => {
  const btn = e.target.closest(".saved-remove-btn, .saved-card-remove");
  if (!btn) return;
  const card = btn.closest("[data-key]");
  if (!card) return;
  const remaining = readSavedItems().filter((s) => s.key !== card.dataset.key);
  writeSavedItems(remaining);
  renderSaved();
});

clearBtn?.addEventListener("click", () => {
  const destination = window.IMAuth?.currentUser ? "your account and synced devices" : "this device";
  if (!confirm(`Remove all saved items from ${destination}?`)) return;
  writeSavedItems([]);
  renderSaved();
});

function updateStorageNote() {
  const note = document.getElementById("storage-note");
  const eyebrow = document.getElementById("saved-eyebrow");
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

window.addEventListener("im-auth-state-changed", () => { renderSaved(); updateStorageNote(); });

renderSaved();
updateStorageNote();
