const {
  escapeHtml,
  getSeriesRegistry,
  getStandaloneLectureRegistry,
  isEpisodeAvailable,
  seriesUrl,
  recordStudySeconds,
  readJsonStorage,
  writeJsonStorage,
  readSavedItems,
  writeSavedItems,
} = window.IMUtils;

function renderGrammarNotes(notes) {
  return notes.map(({ term, arabic, definition }) =>
    `<div class="grammar-card">
      <div class="grammar-card-term">
        <span class="grammar-card-label">${escapeHtml(term)}</span>
        ${arabic ? `<span class="grammar-card-arabic" dir="rtl">${escapeHtml(arabic)}</span>` : ''}
      </div>
      <p class="grammar-card-definition">${escapeHtml(definition)}</p>
    </div>`
  ).join('');
}

function renderRecap(text) {
  return text
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      const applyBold = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (trimmed.startsWith("# ")) {
        return `<h3 class="recap-heading">${applyBold(trimmed.slice(2))}</h3>`;
      }
      return `<p>${applyBold(trimmed)}</p>`;
    })
    .join("");
}

const seriesRegistry = getSeriesRegistry();
const standaloneLectureRegistry = getStandaloneLectureRegistry();

const params = new URLSearchParams(window.location.search);
const pageData = document.body?.dataset || {};
const standaloneLectureId = params.get("lecture") || pageData.lectureId;
const standaloneLecture = standaloneLectureId ? standaloneLectureRegistry[standaloneLectureId] : null;
const isStandalone = Boolean(standaloneLecture);
const seriesSlug = params.get("series") || pageData.seriesSlug;
if (!isStandalone && seriesSlug && !seriesRegistry[seriesSlug]) {
  window.location.replace("./index.html");
  throw new Error("Unknown series: " + seriesSlug);
}
const series = isStandalone
  ? {
      title: "Standalone Lectures",
      slug: "standalone",
      seriesPageUrl: "./index.html#series",
      speaker: standaloneLecture.speaker,
      topic: standaloneLecture.topic || "Standalone Video",
      playlistId: "standalone",
      episodes: [{ ...standaloneLecture, number: null }],
    }
  : seriesRegistry[seriesSlug || "change-of-heart"] || window.changeOfHeartSeries;
const seriesPageUrl = isStandalone ? series.seriesPageUrl : seriesUrl(series);
const episodeUrl = (episode) =>
  isStandalone ? window.IMUtils.standaloneLectureUrl(standaloneLecture) : window.IMUtils.episodeUrl(series, episode);
const episodeThumbnailUrl = (episode) =>
  isStandalone
    ? window.IMUtils.standaloneLectureThumbnailUrl(standaloneLecture)
    : window.IMUtils.episodeThumbnailUrl(series, episode);
const progressKey = (episode) =>
  isStandalone ? window.IMUtils.standaloneProgressKey(standaloneLecture) : window.IMUtils.progressKey(series, episode);
const notesKey = (episode) =>
  isStandalone ? window.IMUtils.standaloneNotesKey(standaloneLecture) : window.IMUtils.notesKey(series, episode);

const requestedVideoId = params.get("video") || pageData.videoId;
if (!isStandalone && requestedVideoId && !series.episodes.some((ep) => ep.id === requestedVideoId)) {
  window.location.replace(seriesPageUrl);
  throw new Error("Unknown episode: " + requestedVideoId);
}
const currentEpisode =
  series.episodes.find((episode) => episode.id === requestedVideoId) || series.episodes[0];
const currentIndex = series.episodes.findIndex((episode) => episode.id === currentEpisode.id);
const previousEpisode = series.episodes
  .slice(0, currentIndex)
  .reverse()
  .find(isEpisodeAvailable);
const nextEpisode = series.episodes.slice(currentIndex + 1).find(isEpisodeAvailable);

const player = document.querySelector("#video-player");
const source = document.querySelector("#video-source");
const captionTrack = document.querySelector("#caption-track");
const unavailable = document.querySelector("#video-unavailable");
const loadingIndicator = document.querySelector("#video-loading");
const title = document.querySelector("#watch-title");
const kicker = document.querySelector("#watch-kicker");
const meta = document.querySelector("#watch-meta");
const previousLink = document.querySelector("#previous-link");
const nextLink = document.querySelector("#next-link");
const episodeList = document.querySelector("#watch-episode-list");
const recapPanel = document.querySelector("#recap-panel");
const recapBody = document.querySelector("#watch-recap");
const grammarNotesPanel = document.querySelector("#grammar-notes-panel");
const grammarNotesBody = document.querySelector("#watch-grammar-notes");
const takeawaysPanel = document.querySelector("#takeaways-panel");
const takeawaysList = document.querySelector("#watch-takeaways .takeaway-list");
const notesTextarea = document.querySelector("#notes-textarea");
const notesEditView = document.querySelector("#notes-edit-view");
const notesPreviewView = document.querySelector("#notes-preview-view");
const notesPreviewBody = document.querySelector("#notes-preview-body");
const notesStatus = document.querySelector("#notes-status");
const notesToolbar = document.querySelector("#notes-toolbar");
const notesTabs = document.querySelectorAll("[data-notes-tab]");
const notesInsertTimestampBtn = document.querySelector("#notes-insert-timestamp");
const notesCurrentTimeLabel = document.querySelector("#notes-current-time-label");
const notesClearBtn = document.querySelector("#notes-clear-btn");
const playlistTitle = document.querySelector("#playlist-title");
const bottomNavSeriesLink = document.querySelector("#bottom-nav-series-link");
const episodeSidebar = document.querySelector(".episode-sidebar");

const saveEpisodeButton = document.querySelector("#save-episode-button");
const shareEpisodeButton = document.querySelector("#share-episode-button");
const actionStatus = document.querySelector("#watch-action-status");

// Save/share confirmations ("Saved for later", "Share sheet opened", ...) are
// meant to be brief, like a toast -- without this they'd sit there forever
// since nothing else ever clears watch-action-status.
let actionStatusTimer = null;
function setActionStatus(message, durationMs = 3000) {
  clearTimeout(actionStatusTimer);
  actionStatus.textContent = message;
  if (durationMs) {
    actionStatusTimer = setTimeout(() => {
      actionStatus.textContent = "";
    }, durationMs);
  }
}

player.setAttribute("playsinline", "");
player.setAttribute("webkit-playsinline", "");
player.setAttribute("x-webkit-airplay", "allow");

const currentTitleLabel = isStandalone
  ? currentEpisode.title
  : `Episode ${currentEpisode.number}: ${currentEpisode.title}`;
const currentTypeLabel = isStandalone ? "Standalone Video" : `Episode ${currentEpisode.number}`;

function setPlayerPoster(episode) {
  player.poster = episodeThumbnailUrl(episode);
}

function setVideoLoading(isLoading) {
  loadingIndicator?.classList.toggle("is-hidden", !isLoading);
}

function savedItem() {
  return {
    key: isStandalone ? `video:${currentEpisode.id}` : `episode:${series.slug}:${currentEpisode.id}`,
    type: isStandalone ? "video" : "episode",
    title: currentTitleLabel,
    subtitle: isStandalone ? `${series.speaker} - Standalone video` : `${series.title} - ${series.speaker}`,
    url: episodeUrl(currentEpisode),
    savedAt: Date.now(),
  };
}

function isEpisodeSaved() {
  const key = savedItem().key;
  return readSavedItems().some((item) => item.key === key);
}

function updateSaveButton() {
  if (!saveEpisodeButton) return;
  saveEpisodeButton.setAttribute("aria-pressed", String(isEpisodeSaved()));
}

function toggleSavedEpisode() {
  const item = savedItem();
  const items = readSavedItems();
  const existing = items.findIndex((saved) => saved.key === item.key);
  const nextItems =
    existing >= 0
      ? items.filter((saved) => saved.key !== item.key)
      : [item, ...items.filter((saved) => saved.key !== item.key)].slice(0, 60);

  if (writeSavedItems(nextItems)) {
    updateSaveButton();
    setActionStatus(existing >= 0 ? "Removed from saved items." : "Saved for later on this device.");
  } else {
    setActionStatus("Could not save on this device.");
  }
}

async function shareEpisode() {
  const url = new URL(savedItem().url, document.baseURI).href;
  const shareData = {
    title: currentTitleLabel,
    text: isStandalone ? `A standalone lecture by ${series.speaker}` : `${series.title} by ${series.speaker}`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      setActionStatus("Share sheet opened.");
      return;
    }

    await navigator.clipboard.writeText(url);
    setActionStatus("Episode link copied.");
  } catch {
    setActionStatus("Could not share from this browser.");
  }
}

saveEpisodeButton?.addEventListener("click", toggleSavedEpisode);
shareEpisodeButton?.addEventListener("click", shareEpisode);
updateSaveButton();

function readProgress(episode) {
  return readJsonStorage(progressKey(episode), {});
}

function buildCardData() {
  return {
    eyebrow: isStandalone
      ? `${standaloneLecture.speaker} - Standalone video`
      : `${series.title} - Episode ${currentEpisode.number}`,
    title: isStandalone ? standaloneLecture.title : currentEpisode.title,
    thumbnail: episodeThumbnailUrl(currentEpisode),
    url: episodeUrl(currentEpisode),
  };
}

function saveProgress() {
  if (!Number.isFinite(player.duration) || player.duration <= 0) {
    return;
  }

  const existing = readProgress(currentEpisode);
  const payload = {
    currentTime: player.currentTime,
    duration: player.duration,
    updatedAt: Date.now(),
    completed: Boolean(existing.completed),
    _card: buildCardData(),
  };

  writeJsonStorage(progressKey(currentEpisode), payload);
}

// Seeking (dragging the scrubber) doesn't commit a new resume position right
// away. A seek only overwrites saved progress after it holds steady for
// SEEK_SETTLE_MS — this gives a short undo window for accidental drags or
// misclicks: seek back before it settles and the original position survives.
const SEEK_SETTLE_MS = 5000;
let seekPending = false;
let seekSettleTimer = null;
let suppressSeekBuffer = false; // true only for the programmatic resume-on-load seek

function commitPendingSeek() {
  seekPending = false;
  seekSettleTimer = null;
  saveProgress();
}

function handleSeeking() {
  resetStudyTimer();
  if (suppressSeekBuffer) return;
  seekPending = true;
  clearTimeout(seekSettleTimer);
  seekSettleTimer = setTimeout(commitPendingSeek, SEEK_SETTLE_MS);
}

const MAX_TRACKABLE_PLAYBACK_RATE = 2.75;
let lastTrackedAt = 0;
let lastTrackedPosition = 0;

function resetStudyTimer() {
  lastTrackedAt = Date.now();
  lastTrackedPosition = Number(player.currentTime) || 0;
}

function trackStudyTime(force = false) {
  if (!recordStudySeconds || player.seeking || (!force && player.paused)) {
    resetStudyTimer();
    return;
  }

  const now = Date.now();
  const currentPosition = Number(player.currentTime) || 0;
  if (!lastTrackedAt) {
    resetStudyTimer();
    return;
  }

  const wallDelta = Math.max(0, (now - lastTrackedAt) / 1000);
  const positionDelta = currentPosition - lastTrackedPosition;
  const allowedDelta = Math.max(8, wallDelta * MAX_TRACKABLE_PLAYBACK_RATE);

  if (positionDelta > 0 && positionDelta <= allowedDelta) {
    recordStudySeconds(positionDelta);
  }

  lastTrackedAt = now;
  lastTrackedPosition = currentPosition;
}

function formatProgress(episode) {
  const progress = readProgress(episode);
  if (progress.completed) {
    return "Watched";
  }

  if (!progress.duration || !progress.currentTime) {
    return "";
  }

  const percent = Math.min(99, Math.round((progress.currentTime / progress.duration) * 100));
  if (percent < 2) {
    return "";
  }

  return `${percent}% watched`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function setupMediaSession() {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentTitleLabel,
    artist: series.speaker,
    album: isStandalone ? "Improving Muslim" : series.title,
    artwork: [
      {
        src: episodeThumbnailUrl(currentEpisode),
        sizes: "480x360",
        type: "image/jpeg",
      },
    ],
  });

  navigator.mediaSession.setActionHandler("play", () => {
    player.play();
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    player.pause();
  });

  navigator.mediaSession.setActionHandler("seekbackward", (details) => {
    player.currentTime = Math.max(0, player.currentTime - (details.seekOffset || 10));
  });

  navigator.mediaSession.setActionHandler("seekforward", (details) => {
    player.currentTime = Math.min(player.duration || player.currentTime, player.currentTime + (details.seekOffset || 10));
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    window.location.href = previousEpisode ? episodeUrl(previousEpisode) : seriesPageUrl;
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    window.location.href = nextEpisode ? episodeUrl(nextEpisode) : seriesPageUrl;
  });
}

function updateMediaSessionState(state) {
  if (!("mediaSession" in navigator)) {
    return;
  }

  navigator.mediaSession.playbackState = state;
}

// Speaker/topic in the meta line link out to the speaker profile and the
// homepage filtered to that category, so learners can find more from the
// same teacher or subject without leaving the player.
function speakerProfileUrl() {
  const slug = isStandalone
    ? standaloneLecture.speakerSlug
    : (window.speakers || []).find((s) => s.name === series.speaker)?.slug;
  return slug ? `./pages/speaker.html?speaker=${encodeURIComponent(slug)}` : null;
}

function primaryCategorySlug() {
  if (isStandalone) return (currentEpisode.categories || [])[0] || null;
  const entry = (window.seriesConfig || []).find((e) => e.slug === series.slug);
  return entry && Array.isArray(entry.categories) ? entry.categories[0] : null;
}

document.title = `${currentTitleLabel} | Improving Muslim`;
title.textContent = currentTitleLabel;
{
  const speakerHref = speakerProfileUrl();
  const categorySlug = primaryCategorySlug();
  const categoryHref = categorySlug ? `./index.html?category=${encodeURIComponent(categorySlug)}#series` : null;
  const speakerHtml = speakerHref
    ? `<a href="${speakerHref}">${escapeHtml(series.speaker)}</a>`
    : escapeHtml(series.speaker);
  const topicHtml = categoryHref
    ? `<a href="${categoryHref}">${escapeHtml(series.topic)}</a>`
    : escapeHtml(series.topic);
  meta.innerHTML = `${speakerHtml} · ${topicHtml} · ${escapeHtml(formatDate(currentEpisode.published))}`;
}
const breadcrumbEp = document.querySelector("#watch-breadcrumb-ep");
// Standalone lectures have no series page to link through, so a 3-segment
// "Home > Standalone Video > Standalone Video" breadcrumb is just noise and
// repeats itself. Collapse it to "Home > {lecture title}" instead.
if (isStandalone) {
  kicker.hidden = true;
  if (kicker.nextElementSibling) kicker.nextElementSibling.hidden = true;
  if (breadcrumbEp) breadcrumbEp.textContent = currentTitleLabel;
} else {
  kicker.textContent = series.title;
  kicker.href = seriesPageUrl;
  if (breadcrumbEp) breadcrumbEp.textContent = currentTypeLabel;
}
setPlayerPoster(currentEpisode);

if (playlistTitle) playlistTitle.textContent = isStandalone ? "More lectures" : series.title;
if (bottomNavSeriesLink) bottomNavSeriesLink.href = seriesPageUrl;
if (episodeSidebar && isStandalone) episodeSidebar.hidden = true;

try {
  localStorage.setItem("improving-muslim:last-series-url", seriesPageUrl);
} catch (error) {
  // Ignore storage failures so the watch page still works in private modes.
}

setupMediaSession();

if (currentEpisode.takeaways && currentEpisode.takeaways.length) {
  const applyBold = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  takeawaysList.innerHTML = currentEpisode.takeaways
    .map((step) => `<li><span>${applyBold(step)}</span></li>`)
    .join("");
  takeawaysPanel.hidden = false;
}

if (currentEpisode.grammarNotes && currentEpisode.grammarNotes.length) {
  grammarNotesBody.innerHTML = renderGrammarNotes(currentEpisode.grammarNotes);
  grammarNotesPanel.hidden = false;
}

if (currentEpisode.recap) {
  recapBody.innerHTML = renderRecap(currentEpisode.recap);
  recapPanel.hidden = false;
}

// ── My Notes ─────────────────────────────────────────────────────────────────
// Personal, per-episode notes. Stored the same way as watch progress (local
// first, synced to Firestore when signed in), keyed by the same series/
// standalone id scheme so notes survive an R2 videoSrc swap.
if (notesTextarea) {
  const notesStorageKey = notesKey(currentEpisode);

  function readNote() {
    return readJsonStorage(notesStorageKey, { text: "", updatedAt: 0 });
  }

  function writeNote(text) {
    writeJsonStorage(notesStorageKey, { text, updatedAt: Date.now() });
  }

  function formatNoteTimestamp(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Markdown-lite + clickable-timestamp renderer for the Preview tab. Mirrors
  // renderRecap's escape-then-format approach, extended with h2/h3, italics,
  // and turning any MM:SS / H:MM:SS token into a button that seeks the player.
  function linkifyNoteTimestamps(escapedHtml) {
    return escapedHtml.replace(/\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b/g, (match, a, b, c) => {
      const seconds = c !== undefined ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
      return `<button type="button" class="note-timestamp" data-seek="${seconds}">${match}</button>`;
    });
  }

  function applyNoteInline(escapedText) {
    let html = escapedText.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    return linkifyNoteTimestamps(html);
  }

  function renderNoteMarkdown(text) {
    return text
      .trim()
      .split(/\n\n+/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/s);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const escaped = escapeHtml(headingMatch[2].trim());
          return `<p class="note-heading note-h${level}">${applyNoteInline(escaped)}</p>`;
        }
        const escaped = escapeHtml(trimmed).replace(/\n/g, "<br>");
        return `<p class="note-line">${applyNoteInline(escaped)}</p>`;
      })
      .join("");
  }

  function renderNotesPreview() {
    const text = notesTextarea.value.trim();
    notesPreviewBody.innerHTML = text
      ? renderNoteMarkdown(text)
      : '<p class="notes-empty">Nothing written yet. Switch to Edit to add notes.</p>';
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    textarea.value = before + prefix + text + after;
    const cursorPos = (before + prefix + text).length;
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.focus();
  }

  function wrapSelection(textarea, before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || "text";
    textarea.value = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    textarea.focus();
  }

  function prefixLine(textarea, prefix) {
    const start = textarea.selectionStart;
    const value = textarea.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = value.indexOf("\n", lineStart);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const stripped = value.slice(lineStart, lineEnd).replace(/^#{1,3}\s*/, "");
    const newLine = prefix + stripped;
    textarea.value = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
    const newCursor = lineStart + newLine.length;
    textarea.setSelectionRange(newCursor, newCursor);
    textarea.focus();
  }

  // Load saved note and keep it saved shortly after the user stops typing.
  notesTextarea.value = readNote().text || "";

  let notesSaveTimer = null;
  let notesStatusClearTimer = null;
  function scheduleNotesSave() {
    if (notesStatus) notesStatus.textContent = "Saving…";
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(() => {
      writeNote(notesTextarea.value);
      if (notesStatus) {
        notesStatus.textContent = "Saved";
        clearTimeout(notesStatusClearTimer);
        notesStatusClearTimer = setTimeout(() => { notesStatus.textContent = ""; }, 2000);
      }
    }, 600);
  }

  notesTextarea.addEventListener("input", scheduleNotesSave);

  // Flush immediately if the user navigates away mid-debounce.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && notesSaveTimer) {
      clearTimeout(notesSaveTimer);
      writeNote(notesTextarea.value);
    }
  });

  if (notesToolbar) {
    notesToolbar.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-note-format]");
      if (!btn) return;
      const format = btn.dataset.noteFormat;
      if (format === "h1") prefixLine(notesTextarea, "# ");
      else if (format === "h2") prefixLine(notesTextarea, "## ");
      else if (format === "h3") prefixLine(notesTextarea, "### ");
      else if (format === "bold") wrapSelection(notesTextarea, "**", "**");
      else if (format === "italic") wrapSelection(notesTextarea, "*", "*");
      scheduleNotesSave();
    });
  }

  if (notesInsertTimestampBtn) {
    notesInsertTimestampBtn.addEventListener("click", () => {
      insertAtCursor(notesTextarea, `${formatNoteTimestamp(player.currentTime)} `);
      scheduleNotesSave();
    });
  }

  if (notesCurrentTimeLabel) {
    player.addEventListener("timeupdate", () => {
      notesCurrentTimeLabel.textContent = formatNoteTimestamp(player.currentTime);
    });
  }

  notesTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      notesTabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });
      const showPreview = tab.dataset.notesTab === "preview";
      notesEditView.hidden = showPreview;
      notesPreviewView.hidden = !showPreview;
      if (showPreview) renderNotesPreview();
    });
  });

  if (notesPreviewBody) {
    notesPreviewBody.addEventListener("click", (event) => {
      const btn = event.target.closest(".note-timestamp");
      if (!btn) return;
      const seconds = Number(btn.dataset.seek);
      if (!Number.isFinite(seconds)) return;
      player.currentTime = Math.min(seconds, player.duration || seconds);
      player.play().catch(() => {});
      player.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  if (notesClearBtn) {
    notesClearBtn.addEventListener("click", () => {
      if (!notesTextarea.value.trim()) return;
      if (!window.confirm("Clear all notes for this episode? This cannot be undone.")) return;
      notesTextarea.value = "";
      writeNote("");
      renderNotesPreview();
      if (notesStatus) notesStatus.textContent = "Cleared";
    });
  }
}

// ── Stall / error detection ─────────────────────────────────────────────────
// Diagnoses why a video failed and returns a user-facing message + cause tag.
// Cause precedence: real MediaError > slow connection > unknown stall.
const STALL_TIMEOUT_MS = 20_000;
const MAX_AUTO_RETRIES = 2;
let stallTimer = null;
let autoRetries = 0;

function retryVideoLoad() {
  unavailable.classList.add("is-hidden");
  setVideoLoading(true);
  // load() fires loadstart (re-arming the stall timer) and loadedmetadata
  // (restoring the saved resume position), so no extra bookkeeping needed.
  player.load();
}

function clearStallTimer() {
  if (stallTimer !== null) {
    clearTimeout(stallTimer);
    stallTimer = null;
  }
}

function diagnoseVideoFailure(videoEl) {
  const err = videoEl.error;
  if (err) {
    if (err.code === MediaError.MEDIA_ERR_DECODE) {
      return { cause: 'decode', heading: 'Playback error', body: 'This video has a decode error — it may be corrupted. We\'ve been notified and will look into it.' };
    }
    if (err.code === MediaError.MEDIA_ERR_NETWORK) {
      return { cause: 'network', heading: 'Network error', body: 'Couldn\'t reach this video — check your internet connection and try refreshing.' };
    }
    if (err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return { cause: 'unsupported', heading: 'Format not supported', body: 'Your browser can\'t play this video format. Try a different browser.' };
    }
    return { cause: 'error', heading: 'Playback error', body: 'An error occurred playing this video. Please try refreshing the page.' };
  }
  const conn = navigator.connection;
  const slowConn = conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
  const hasData = videoEl.buffered.length > 0;
  // Safari and Firefox never expose navigator.connection, so a stall there is
  // most likely a connection hiccup, not a broken file.
  if (slowConn || hasData || !conn) {
    return { cause: 'slow', heading: 'Connection trouble', body: 'This is usually a connection hiccup. Check your internet and try again.' };
  }
  return { cause: 'stall', heading: 'Video couldn\'t load', body: 'This is usually a connection hiccup — try again in a moment. We\'ve also been notified in case it\'s a problem on our side.' };
}

function reportVideoIssue(videoSrc, cause, readyState) {
  const conn = navigator.connection;
  const payload = new FormData();
  payload.set('_subject', `Video ${cause}: ` + location.pathname);
  payload.set('_template', 'box');
  payload.set('page', location.href);
  payload.set('cause', cause);
  payload.set('error', `readyState: ${readyState}, buffered: ${player.buffered.length}, errorCode: ${player.error?.code ?? 'none'}, connection: ${conn?.effectiveType ?? 'unknown'}, autoRetries: ${autoRetries}`);
  payload.set('videoSrc', videoSrc || '(unknown)');
  payload.set('browser', navigator.userAgent);
  fetch('https://formsubmit.co/ajax/contact@improvingmuslim.com', {
    method: 'POST',
    body: payload,
    headers: { Accept: 'application/json' },
  }).catch(() => { /* silent */ });
}

function showVideoError(videoEl, videoSrc) {
  const { cause, heading, body } = diagnoseVideoFailure(videoEl);
  unavailable.innerHTML = `<strong>${heading}</strong><span>${body}</span><button type="button" class="video-retry-btn">Try again</button>`;
  unavailable.querySelector(".video-retry-btn").addEventListener("click", () => {
    autoRetries = 0;
    retryVideoLoad();
  });
  unavailable.classList.remove("is-hidden");
  // Only report issues we need to investigate; slow connections are expected
  if (cause !== 'slow') {
    reportVideoIssue(videoSrc, cause, videoEl.readyState);
  }
}
// ────────────────────────────────────────────────────────────────────────────

player.addEventListener("loadstart", () => {
  unavailable.classList.add("is-hidden");
  setVideoLoading(Boolean(currentEpisode.videoSrc));

  if (currentEpisode.videoSrc) {
    clearStallTimer();
    stallTimer = setTimeout(() => {
      if (player.readyState < 2) {
        if (!player.error && autoRetries < MAX_AUTO_RETRIES) {
          autoRetries += 1;
          retryVideoLoad();
          return;
        }
        setVideoLoading(false);
        showVideoError(player, currentEpisode.videoSrc);
      }
    }, STALL_TIMEOUT_MS);
  }
});

player.addEventListener("waiting", () => {
  setVideoLoading(Boolean(currentEpisode.videoSrc));
});

player.addEventListener("canplay", () => {
  clearStallTimer();
  autoRetries = 0;
  setVideoLoading(false);
});

player.addEventListener("playing", () => {
  clearStallTimer();
  autoRetries = 0;
  setVideoLoading(false);
});

player.addEventListener("error", () => {
  clearStallTimer();
  if (player.error?.code === MediaError.MEDIA_ERR_NETWORK && autoRetries < MAX_AUTO_RETRIES) {
    autoRetries += 1;
    retryVideoLoad();
    return;
  }
  setVideoLoading(false);
  if (player.currentSrc) {
    showVideoError(player, player.currentSrc);
  }
});

player.addEventListener("loadedmetadata", () => {
  unavailable.classList.add("is-hidden");

  if (captionTrack?.track) {
    captionTrack.track.mode = currentEpisode.captionsSrc ? "showing" : "disabled";
  }

  const progress = readProgress(currentEpisode);
  const resumeTime = Number(progress.currentTime) || 0;
  const almostFinished = resumeTime > player.duration - 30;

  if (resumeTime > 10 && !almostFinished) {
    try {
      suppressSeekBuffer = true;
      player.currentTime = resumeTime;
    } catch (error) {
      suppressSeekBuffer = false;
      return;
    }
  }
});

player.addEventListener("seeked", () => {
  suppressSeekBuffer = false;
});

if (currentEpisode.videoSrc) {
  setVideoLoading(true);
  source.src = currentEpisode.videoSrc;
  if (currentEpisode.captionsSrc && captionTrack) {
    captionTrack.src = currentEpisode.captionsSrc;
    captionTrack.default = true;
    if (captionTrack.track) {
      captionTrack.track.mode = "showing";
    }
  } else if (captionTrack) {
    captionTrack.remove();
  }
  player.load();
} else {
  setVideoLoading(false);
  unavailable.innerHTML = `
    <strong>Video not added yet</strong>
    <span>${currentEpisode.statusNote || "This episode will be uploaded in the future, insha'Allah."}</span>
  `;
  unavailable.classList.remove("is-hidden");
}

player.addEventListener("timeupdate", () => {
  trackStudyTime();
  if (!seekPending) saveProgress();
});

player.addEventListener("pause", () => {
  trackStudyTime(true);
  if (!seekPending) saveProgress();
  updateMediaSessionState("paused");
});

player.addEventListener("ended", () => {
  trackStudyTime(true);
  clearTimeout(seekSettleTimer);
  seekPending = false;
  if (
    writeJsonStorage(progressKey(currentEpisode), {
      currentTime: player.duration || currentEpisode.duration || 0,
      duration: player.duration || currentEpisode.duration || 0,
      updatedAt: Date.now(),
      completed: true,
    })
  ) {
    const currentCompactEpisode = episodeList.querySelector(".compact-episode.is-current");
    if (currentCompactEpisode) {
      currentCompactEpisode.classList.add("is-watched");
      const details = currentCompactEpisode.querySelector("span");
      const existingProgress = details?.querySelector("em");
      if (existingProgress) {
        existingProgress.textContent = "Watched";
      } else if (details) {
        details.insertAdjacentHTML("beforeend", "<em>Watched</em>");
      }
    }
  }
  updateMediaSessionState("none");
});

player.addEventListener("play", () => {
  resetStudyTimer();
  updateMediaSessionState("playing");
});

player.addEventListener("seeking", handleSeeking);

const AUTOPLAY_KEY = "improving-muslim:autoplay-next";
const autoplayToast       = document.querySelector("#autoplay-toast");
const autoplayCountdown   = document.querySelector("#autoplay-countdown");
const autoplayToastLink   = document.querySelector("#autoplay-toast-link");
const autoplayToastCancel = document.querySelector("#autoplay-toast-cancel");
let autoplayTimer = null;

function cancelAutoplay() {
  clearInterval(autoplayTimer);
  autoplayTimer = null;
  if (autoplayToast) autoplayToast.classList.add("is-hidden");
}

player.addEventListener("ended", () => {
  if (localStorage.getItem(AUTOPLAY_KEY) !== "on" || !nextEpisode || !autoplayToast) return;
  const nextUrl = episodeUrl(nextEpisode);
  autoplayToastLink.href = nextUrl;
  autoplayToast.classList.remove("is-hidden");
  let remaining = 5;
  autoplayCountdown.textContent = remaining;
  autoplayTimer = setInterval(() => {
    remaining -= 1;
    autoplayCountdown.textContent = remaining;
    if (remaining <= 0) { cancelAutoplay(); window.location.href = nextUrl; }
  }, 1000);
});

autoplayToastCancel?.addEventListener("click", cancelAutoplay);
autoplayToastLink?.addEventListener("click", () => clearInterval(autoplayTimer));

if (previousLink) {
  previousLink.href = previousEpisode ? episodeUrl(previousEpisode) : seriesPageUrl;
  previousLink.textContent = previousEpisode ? "Previous episode" : isStandalone ? "Back to lectures" : "Back to series";
}

if (nextLink) {
  nextLink.href = nextEpisode ? episodeUrl(nextEpisode) : seriesPageUrl;
  nextLink.textContent = nextEpisode ? "Next episode" : isStandalone ? "Browse lectures" : "Series overview";
}

// Real next-episode card at the top of the sidebar — thumbnail, title, and
// duration make continuing one obvious tap instead of a text label.
if (!isStandalone && nextEpisode && episodeSidebar) {
  const nextMins = nextEpisode.duration ? `${Math.round(nextEpisode.duration / 60)} min` : "";
  const nextRecap = nextEpisode.recap ? "Recap available" : "";
  const nextMeta = [nextMins, nextRecap].filter(Boolean).join(" · ");
  const upNextCard = document.createElement("a");
  upNextCard.className = "up-next-card";
  upNextCard.href = episodeUrl(nextEpisode);
  upNextCard.innerHTML = `
    <img src="${episodeThumbnailUrl(nextEpisode)}" alt="" loading="lazy" />
    <span class="up-next-body">
      <small>Up next</small>
      <strong>Ep ${nextEpisode.number} — ${nextEpisode.title}</strong>
      ${nextMeta ? `<em>${nextMeta}</em>` : ""}
    </span>
    <span class="up-next-play" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
    </span>
  `;
  episodeSidebar.insertBefore(upNextCard, episodeList);
}

episodeList.innerHTML = isStandalone ? "" : series.episodes
  .map(
    (episode) => {
      const progressLabel = formatProgress(episode);
      const isWatched = progressLabel === "Watched";
      const available = isEpisodeAvailable(episode);
      const tagName = available ? "a" : "div";
      const href = available ? ` href="${episodeUrl(episode)}"` : "";
      return `
        <${tagName} class="compact-episode ${episode.id === currentEpisode.id ? "is-current" : ""} ${available ? "" : "is-unavailable"} ${isWatched ? "is-watched" : ""}"${href}>
          <img src="${episodeThumbnailUrl(episode)}" alt="" loading="lazy" />
          <span>
            <small>Episode ${episode.number}</small>
            <strong>${episode.title}</strong>
            ${progressLabel ? `<em>${progressLabel}</em>` : ""}
            ${available ? "" : "<em>Uploading soon</em>"}
          </span>
        </${tagName}>
      `;
    },
  )
  .join("");

const currentCompact = episodeList.querySelector(".compact-episode.is-current");
if (currentCompact) {
  if (window.matchMedia("(max-width: 900px)").matches) {
    const chip = document.createElement("div");
    chip.className = "now-playing-chip";
    chip.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg> Now playing: ${currentTypeLabel}`;
    episodeList.insertBefore(chip, episodeList.firstChild);
  } else {
    currentCompact.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
}

// Mobile: collapsible episode list for long series
if (window.matchMedia("(max-width: 900px)").matches) {
  const episodeCount = episodeList.querySelectorAll(".compact-episode").length;
  if (episodeCount > 5) {
    episodeList.classList.add("is-collapsed");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "episode-list-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "watch-episode-list");
    btn.innerHTML = `<span>Show all episodes</span><span class="episode-list-toggle-count">${episodeCount}</span>`;
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      episodeList.classList.toggle("is-collapsed", expanded);
      btn.querySelector("span").textContent = expanded ? "Show all episodes" : "Hide episodes";
      if (expanded) {
        const current = episodeList.querySelector(".compact-episode.is-current");
        if (current) current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    episodeSidebar.insertBefore(btn, episodeList);
  }
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
// Override the browser's native arrow-key seek (varies: 5s Chrome, 15s Firefox)
// to a consistent 10 seconds. Only active when no text input is focused.
//
// Must run in the CAPTURE phase with stopPropagation: when the <video> has
// focus, Chrome's built-in controls handle arrow keys via listeners inside the
// player's shadow DOM that ignore preventDefault from page listeners. Without
// this, both the native seek and ours fire on every press, so a single tap
// (or a brief key-repeat hold) compounds into a much larger jump.
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select, [contenteditable]")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!currentEpisode.videoSrc || player.readyState === 0) return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    e.stopPropagation();
    player.currentTime = Math.max(0, player.currentTime - 10);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    e.stopPropagation();
    player.currentTime = Math.min(player.duration || Infinity, player.currentTime + 10);
  }
}, true);
