const {
  escapeHtml,
  getSeriesRegistry,
  getStandaloneLectureRegistry,
  isEpisodeAvailable,
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
const standaloneLectureId = params.get("lecture");
const standaloneLecture = standaloneLectureId ? standaloneLectureRegistry[standaloneLectureId] : null;
const isStandalone = Boolean(standaloneLecture);
const seriesSlug = params.get("series");
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
const seriesPageUrl = series.seriesPageUrl || "./index.html";
const episodeUrl = (episode) =>
  isStandalone ? window.IMUtils.standaloneLectureUrl(standaloneLecture) : window.IMUtils.episodeUrl(series, episode);
const episodeThumbnailUrl = (episode) =>
  isStandalone
    ? window.IMUtils.standaloneLectureThumbnailUrl(standaloneLecture)
    : window.IMUtils.episodeThumbnailUrl(series, episode);
const progressKey = (episode) =>
  isStandalone ? window.IMUtils.standaloneProgressKey(standaloneLecture) : window.IMUtils.progressKey(series, episode);

const requestedVideoId = params.get("video");
if (!isStandalone && requestedVideoId && !series.episodes.some((ep) => ep.id === requestedVideoId)) {
  window.location.replace(`./pages/series-detail.html?id=${series.slug}`);
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
const playlistTitle = document.querySelector("#playlist-title");
const bottomNavSeriesLink = document.querySelector("#bottom-nav-series-link");
const episodeSidebar = document.querySelector(".episode-sidebar");

const saveEpisodeButton = document.querySelector("#save-episode-button");
const shareEpisodeButton = document.querySelector("#share-episode-button");
const actionStatus = document.querySelector("#watch-action-status");

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
    url: isStandalone
      ? `./pages/watch.html?lecture=${currentEpisode.id}`
      : `./pages/watch.html?series=${series.slug}&video=${currentEpisode.id}`,
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
    actionStatus.textContent = existing >= 0 ? "Removed from saved items." : "Saved for later on this device.";
  } else {
    actionStatus.textContent = "Could not save on this device.";
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
      actionStatus.textContent = "Share sheet opened.";
      return;
    }

    await navigator.clipboard.writeText(url);
    actionStatus.textContent = "Episode link copied.";
  } catch {
    actionStatus.textContent = "Could not share from this browser.";
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

document.title = `${currentTitleLabel} | Improving Muslim`;
title.textContent = currentTitleLabel;
kicker.textContent = isStandalone ? "Standalone Video" : series.title;
kicker.href = seriesPageUrl;
meta.textContent = `${series.speaker} · ${series.topic} · ${formatDate(currentEpisode.published)}`;
const breadcrumbEp = document.querySelector("#watch-breadcrumb-ep");
if (breadcrumbEp) breadcrumbEp.textContent = currentTypeLabel;
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

// ── Stall / error detection ─────────────────────────────────────────────────
// Diagnoses why a video failed and returns a user-facing message + cause tag.
// Cause precedence: real MediaError > slow connection > unknown stall.
const STALL_TIMEOUT_MS = 20_000;
let stallTimer = null;

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
  if (slowConn || hasData) {
    return { cause: 'slow', heading: 'Slow connection', body: 'Your connection is too slow to stream this video right now. Try pausing for a minute to let it buffer, then press play.' };
  }
  return { cause: 'stall', heading: 'Video couldn\'t load', body: 'The file may need to be re-processed before it can stream. We\'ve been notified and will look into it — please check back later.' };
}

function reportVideoIssue(videoSrc, cause, readyState) {
  const conn = navigator.connection;
  const payload = new FormData();
  payload.set('_subject', `Video ${cause}: ` + location.pathname);
  payload.set('_template', 'box');
  payload.set('page', location.href);
  payload.set('cause', cause);
  payload.set('error', `readyState: ${readyState}, buffered: ${player.buffered.length}, errorCode: ${player.error?.code ?? 'none'}, connection: ${conn?.effectiveType ?? 'unknown'}`);
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
  unavailable.innerHTML = `<strong>${heading}</strong><span>${body}</span>`;
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
  setVideoLoading(false);
});

player.addEventListener("playing", () => {
  clearStallTimer();
  setVideoLoading(false);
});

player.addEventListener("error", () => {
  clearStallTimer();
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
      player.currentTime = resumeTime;
    } catch (error) {
      return;
    }
  }
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
  saveProgress();
});

player.addEventListener("pause", () => {
  saveProgress();
  updateMediaSessionState("paused");
});

player.addEventListener("ended", () => {
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
  updateMediaSessionState("playing");
});

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
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select, [contenteditable]")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!currentEpisode.videoSrc || player.readyState === 0) return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    player.currentTime = Math.max(0, player.currentTime - 10);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    player.currentTime = Math.min(player.duration || Infinity, player.currentTime + 10);
  }
});
