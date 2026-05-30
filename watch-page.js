const series = window.changeOfHeartSeries;
const params = new URLSearchParams(window.location.search);
const requestedVideoId = params.get("video");
const currentEpisode =
  series.episodes.find((episode) => episode.id === requestedVideoId) || series.episodes[0];
const currentIndex = series.episodes.findIndex((episode) => episode.id === currentEpisode.id);
const previousEpisode = series.episodes[currentIndex - 1];
const nextEpisode = series.episodes[currentIndex + 1];

const player = document.querySelector("#video-player");
const source = document.querySelector("#video-source");
const unavailable = document.querySelector("#video-unavailable");
const title = document.querySelector("#watch-title");
const kicker = document.querySelector("#watch-kicker");
const meta = document.querySelector("#watch-meta");
const previousLink = document.querySelector("#previous-link");
const nextLink = document.querySelector("#next-link");
const episodeList = document.querySelector("#watch-episode-list");

player.setAttribute("playsinline", "");
player.setAttribute("webkit-playsinline", "");
player.setAttribute("x-webkit-airplay", "allow");

function episodeUrl(episode) {
  return `./watch.html?series=change-of-heart&video=${episode.id}`;
}

function episodeThumbnailUrl(episode, quality = "hqdefault") {
  return `https://i.ytimg.com/vi/${episode.id}/${quality}.jpg`;
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

  const payload = {
    currentTime: player.currentTime,
    duration: player.duration,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(progressKey(currentEpisode), JSON.stringify(payload));
  } catch (error) {
    return;
  }
}

function formatProgress(episode) {
  const progress = readProgress(episode);
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
    window.location.href = previousEpisode ? episodeUrl(previousEpisode) : "./series-change-of-heart.html";
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    window.location.href = nextEpisode ? episodeUrl(nextEpisode) : "./series-change-of-heart.html";
  });
}

function updateMediaSessionState(state) {
  if (!("mediaSession" in navigator)) {
    return;
  }

  navigator.mediaSession.playbackState = state;
}

document.title = `Episode ${currentEpisode.number}: ${currentEpisode.title} | Islamic Lecture Series`;
title.textContent = `Episode ${currentEpisode.number}: ${currentEpisode.title}`;
kicker.textContent = `${series.title} | ${series.speaker}`;
meta.textContent = `${series.topic} - Published ${formatDate(currentEpisode.published)}`;
player.poster = episodeThumbnailUrl(currentEpisode);
setupMediaSession();

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

source.src = currentEpisode.videoSrc;
player.load();

player.addEventListener("timeupdate", () => {
  saveProgress();
});

player.addEventListener("pause", () => {
  saveProgress();
  updateMediaSessionState("paused");
});

player.addEventListener("ended", () => {
  try {
    localStorage.removeItem(progressKey(currentEpisode));
  } catch (error) {
    return;
  }
  updateMediaSessionState("none");
});

player.addEventListener("play", () => {
  updateMediaSessionState("playing");
});

if (previousEpisode) {
  previousLink.href = episodeUrl(previousEpisode);
  previousLink.textContent = "Previous episode";
} else {
  previousLink.href = "./series-change-of-heart.html";
  previousLink.textContent = "Back to series";
}

if (nextEpisode) {
  nextLink.href = episodeUrl(nextEpisode);
  nextLink.textContent = "Next episode";
} else {
  nextLink.href = "./series-change-of-heart.html";
  nextLink.textContent = "Series overview";
}

episodeList.innerHTML = series.episodes
  .map(
    (episode) => {
      const progressLabel = formatProgress(episode);
      return `
        <a class="compact-episode ${episode.id === currentEpisode.id ? "is-current" : ""}" href="${episodeUrl(episode)}">
          <img src="${episodeThumbnailUrl(episode, "mqdefault")}" alt="" loading="lazy" />
          <span>
            <small>Episode ${episode.number}</small>
            <strong>${episode.title}</strong>
            ${progressLabel ? `<em>${progressLabel}</em>` : ""}
          </span>
        </a>
      `;
    },
  )
  .join("");
