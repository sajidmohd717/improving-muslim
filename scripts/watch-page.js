// Watch-page controller: resolves the requested series/episode or standalone
// lecture, wires the native player (progress saving, resume, study-time
// tracking, media session, autoplay-next, keyboard seeking), and renders the
// header, meta line, and study panels. The heavy lifting lives in focused
// modules loaded before this file:
//   - watch-notes.js (IMWatchNotes): the per-episode "My Notes" panel
//   - watch-stall.js (IMWatchStall): stall/error diagnosis, retry, reporting
//   - watch-sidebar.js (IMWatchSidebar): up-next, episode list, related
const {
  escapeHtml,
  getSeriesRegistry,
  getStandaloneLectureRegistry,
  isEpisodeAvailable,
  seriesUrl,
  recordStudySeconds,
  readJsonStorage,
  writeJsonStorage,
} = window.IMUtils;

const { setVideoLoading } = window.IMWatchStall;
const { isSaved, toggleSaved, shareContent } = window.IMContentActions;

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
const title = document.querySelector("#watch-title");
const kicker = document.querySelector("#watch-kicker");
const meta = document.querySelector("#watch-meta");
const previousLink = document.querySelector("#previous-link");
const nextLink = document.querySelector("#next-link");
const recapPanel = document.querySelector("#recap-panel");
const recapBody = document.querySelector("#watch-recap");
const grammarNotesPanel = document.querySelector("#grammar-notes-panel");
const grammarNotesBody = document.querySelector("#watch-grammar-notes");
const takeawaysPanel = document.querySelector("#takeaways-panel");
const takeawaysList = document.querySelector("#watch-takeaways .takeaway-list");
const bottomNavSeriesLink = document.querySelector("#bottom-nav-series-link");

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

// Catalog key for this lecture — used by related ranking and the anonymous
// popularity counters (same scheme as data/catalog-data.js).
const catalogKey = isStandalone
  ? `video:${currentEpisode.id}`
  : `episode:${series.slug}:${currentEpisode.id}`;

const currentTitleLabel = isStandalone
  ? currentEpisode.title
  : `Episode ${currentEpisode.number}: ${currentEpisode.title}`;
const currentTypeLabel = isStandalone ? "Standalone Video" : `Episode ${currentEpisode.number}`;

function setPlayerPoster(episode) {
  player.poster = episodeThumbnailUrl(episode);
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
  return isSaved(savedItem().key);
}

function updateSaveButton() {
  if (!saveEpisodeButton) return;
  saveEpisodeButton.setAttribute("aria-pressed", String(isEpisodeSaved()));
}

function toggleSavedEpisode() {
  const item = savedItem();
  const result = toggleSaved(item);
  if (result.ok) {
    updateSaveButton();
    setActionStatus(result.saved ? "Saved for later on this device." : "Removed from saved items.");
  } else {
    setActionStatus("Could not save on this device.");
  }
}

async function shareEpisode() {
  const url = new URL(savedItem().url, document.baseURI).href;
  try {
    const method = await shareContent({
      title: currentTitleLabel,
      text: isStandalone ? `A standalone lecture by ${series.speaker}` : `${series.title} by ${series.speaker}`,
      url,
    });
    setActionStatus(method === "copied" ? "Episode link copied." : "Share sheet opened.");
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

if (bottomNavSeriesLink) bottomNavSeriesLink.href = seriesPageUrl;

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

window.IMWatchNotes.init({ player, storageKey: notesKey(currentEpisode) });

// Stall/error listeners must be armed before the first player.load() below.
window.IMWatchStall.init({ player, videoSrc: currentEpisode.videoSrc });

player.addEventListener("loadedmetadata", () => {
  unavailable.classList.add("is-hidden");

  if (captionTrack?.track) {
    captionTrack.track.mode = currentEpisode.captionsSrc ? "showing" : "disabled";
  }

  // ?t= deep links (e.g. from transcript search results) win over the saved
  // resume position — the visitor asked for a specific moment.
  const requestedStart = Number(params.get("t"));
  if (Number.isFinite(requestedStart) && requestedStart > 0) {
    try {
      suppressSeekBuffer = true;
      player.currentTime = Math.min(requestedStart, Math.max(0, player.duration - 1));
    } catch (error) {
      suppressSeekBuffer = false;
    }
    return;
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
    window.IMWatchSidebar.markCurrentWatched();
  }
  updateMediaSessionState("none");
});

player.addEventListener("play", () => {
  resetStudyTimer();
  updateMediaSessionState("playing");
});

// Anonymous aggregate popularity counters (no user ids). "play" fires once
// per page view on the first real playback; "complete" when the video ends.
// IMPopularity dedupes per lecture per day on this device.
if (window.IMPopularity) {
  player.addEventListener("playing", () => window.IMPopularity.logPlay(catalogKey), { once: true });
  player.addEventListener("ended", () => window.IMPopularity.logComplete(catalogKey), { once: true });
}

player.addEventListener("seeking", handleSeeking);

if (previousLink) {
  previousLink.href = previousEpisode ? episodeUrl(previousEpisode) : seriesPageUrl;
  previousLink.textContent = previousEpisode ? "Previous episode" : isStandalone ? "Back to lectures" : "Back to series";
}

if (nextLink) {
  nextLink.href = nextEpisode ? episodeUrl(nextEpisode) : seriesPageUrl;
  nextLink.textContent = nextEpisode ? "Next episode" : isStandalone ? "Browse lectures" : "Series overview";
}

const { relatedUpNextUrl } = window.IMWatchSidebar.init({
  series,
  currentEpisode,
  nextEpisode,
  isStandalone,
  catalogKey,
  episodeUrl,
  episodeThumbnailUrl,
  formatProgress,
  currentTypeLabel,
});

const AUTOPLAY_KEY = "improving-muslim:autoplay-next";
const autoplayToast       = document.querySelector("#autoplay-toast");
const autoplayCountdown   = document.querySelector("#autoplay-countdown");
const autoplayToastLink   = document.querySelector("#autoplay-toast-link");
const autoplayToastCancel = document.querySelector("#autoplay-toast-cancel");
let autoplayTimer = null;
// Series episodes autoplay into the next episode; standalone lectures autoplay
// into the top related lecture picked by the sidebar module.
const autoplayNextUrl = nextEpisode ? episodeUrl(nextEpisode) : relatedUpNextUrl;

function cancelAutoplay() {
  clearInterval(autoplayTimer);
  autoplayTimer = null;
  if (autoplayToast) autoplayToast.classList.add("is-hidden");
}

player.addEventListener("ended", () => {
  if (localStorage.getItem(AUTOPLAY_KEY) !== "on" || !autoplayNextUrl || !autoplayToast) return;
  const nextUrl = autoplayNextUrl;
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
