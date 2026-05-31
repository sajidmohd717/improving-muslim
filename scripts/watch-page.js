function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

const seriesRegistry = {
  "change-of-heart": window.changeOfHeartSeries,
  "enjoy-your-prayer": window.enjoyYourPrayerSeries,
  "forty-hadith-nawawi": window.fortyHadithSeries,
  "why-me": window.whyMeSeries,
};

const params = new URLSearchParams(window.location.search);
const seriesSlug = params.get("series") || "change-of-heart";
const series = seriesRegistry[seriesSlug] || window.changeOfHeartSeries;
const seriesPageUrl = series.seriesPageUrl || "./index.html";

const requestedVideoId = params.get("video");
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
const episodeList = document.querySelector("#watch-episode-list");
const recapPanel = document.querySelector("#recap-panel");
const recapBody = document.querySelector("#watch-recap");
const takeawaysPanel = document.querySelector("#takeaways-panel");
const takeawaysList = document.querySelector("#watch-takeaways .takeaway-list");
const playlistTitle = document.querySelector("#playlist-title");
const bottomNavSeriesLink = document.querySelector("#bottom-nav-series-link");

const speedButton = document.querySelector("#speed-button");
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SPEED_KEY = "improving-muslim:playback-speed";

let currentSpeedIndex = (() => {
  try {
    const saved = parseFloat(localStorage.getItem(SPEED_KEY));
    const idx = SPEEDS.indexOf(saved);
    return idx >= 0 ? idx : 1;
  } catch { return 1; }
})();

function applySpeed(index) {
  currentSpeedIndex = index;
  const speed = SPEEDS[index];
  player.playbackRate = speed;
  speedButton.textContent = speed === 1 ? "1×" : speed + "×";
  try { localStorage.setItem(SPEED_KEY, String(speed)); } catch {}
}

applySpeed(currentSpeedIndex);
speedButton.addEventListener("click", () => applySpeed((currentSpeedIndex + 1) % SPEEDS.length));

player.setAttribute("playsinline", "");
player.setAttribute("webkit-playsinline", "");
player.setAttribute("x-webkit-airplay", "allow");

function episodeUrl(episode) {
  return `./pages/watch.html?series=${seriesSlug}&video=${episode.id}`;
}

function isEpisodeAvailable(episode) {
  return Boolean(episode.videoSrc);
}

function episodeThumbnailUrl(episode, quality = "hqdefault") {
  return `https://i.ytimg.com/vi/${episode.id}/${quality}.jpg`;
}

function setPlayerPoster(episode) {
  player.poster = episodeThumbnailUrl(episode);

  const highResPoster = new Image();
  highResPoster.onload = () => {
    if (highResPoster.naturalWidth >= 640) {
      player.poster = highResPoster.src;
    }
  };
  highResPoster.src = episodeThumbnailUrl(episode, "maxresdefault");
}

function progressKey(episode) {
  return `lecture-progress:${series.playlistId}:${episode.id}`;
}

function readProgress(episode) {
  try {
    return JSON.parse(localStorage.getItem(progressKey(episode))) || {};
  } catch (error) {
    return {};
  }
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
  };

  try {
    localStorage.setItem(progressKey(currentEpisode), JSON.stringify(payload));
  } catch (error) {
    return;
  }
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
    title: `Episode ${currentEpisode.number}: ${currentEpisode.title}`,
    artist: series.speaker,
    album: series.title,
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

document.title = `Episode ${currentEpisode.number}: ${currentEpisode.title} | Improving Muslim`;
title.textContent = `Episode ${currentEpisode.number}: ${currentEpisode.title}`;
kicker.textContent = series.title;
kicker.href = seriesPageUrl;
meta.textContent = `${series.speaker} · ${series.topic} · ${formatDate(currentEpisode.published)}`;
const breadcrumbEp = document.querySelector("#watch-breadcrumb-ep");
if (breadcrumbEp) breadcrumbEp.textContent = `Episode ${currentEpisode.number}`;
setPlayerPoster(currentEpisode);

if (playlistTitle) playlistTitle.textContent = series.title;
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

if (currentEpisode.recap) {
  recapBody.innerHTML = renderRecap(currentEpisode.recap);
  recapPanel.hidden = false;
}

player.addEventListener("loadstart", () => {
  unavailable.classList.add("is-hidden");
});

player.addEventListener("error", () => {
  if (player.currentSrc) {
    unavailable.classList.remove("is-hidden");
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
  try {
    localStorage.setItem(
      progressKey(currentEpisode),
      JSON.stringify({
        currentTime: player.duration || currentEpisode.duration || 0,
        duration: player.duration || currentEpisode.duration || 0,
        updatedAt: Date.now(),
        completed: true,
      }),
    );
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
  } catch (error) {
    return;
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

if (previousEpisode) {
  previousLink.href = episodeUrl(previousEpisode);
  previousLink.textContent = "Previous episode";
} else {
  previousLink.href = seriesPageUrl;
  previousLink.textContent = "Back to series";
}

if (nextEpisode) {
  nextLink.href = episodeUrl(nextEpisode);
  nextLink.textContent = "Next episode";
} else {
  nextLink.href = seriesPageUrl;
  nextLink.textContent = "Series overview";
}

episodeList.innerHTML = series.episodes
  .map(
    (episode) => {
      const progressLabel = formatProgress(episode);
      const isWatched = progressLabel === "Watched";
      const available = isEpisodeAvailable(episode);
      const tagName = available ? "a" : "div";
      const href = available ? ` href="${episodeUrl(episode)}"` : "";
      return `
        <${tagName} class="compact-episode ${episode.id === currentEpisode.id ? "is-current" : ""} ${available ? "" : "is-unavailable"} ${isWatched ? "is-watched" : ""}"${href}>
          <img src="${episodeThumbnailUrl(episode, "mqdefault")}" alt="" loading="lazy" />
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
    chip.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg> Now playing: Episode ${currentEpisode.number}`;
    episodeList.insertBefore(chip, episodeList.firstChild);
  } else {
    currentCompact.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
}
