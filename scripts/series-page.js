function formatViews(n) {
  if (!n) return "";
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K views`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

const series = window.currentSeries;
const episodeList = document.querySelector("#episode-list");
const startLink = document.querySelector("#start-series-link");

function episodeUrl(episode) {
  return `./pages/watch.html?series=${series.slug}&video=${episode.id}`;
}

function isEpisodeAvailable(episode) {
  return Boolean(episode.videoSrc);
}

function episodeThumbnailUrl(episode) {
  if (episode.thumbnailSrc) {
    return episode.thumbnailSrc;
  }

  if (series.episodeThumbnailPath && episode.number) {
    return `${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`;
  }

  return series.thumbnailSrc || "./public/icon.png";
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

function progressLabel(episode) {
  const progress = readProgress(episode);
  if (progress.completed) {
    return "Watched";
  }

  const currentTime = Number(progress.currentTime) || 0;
  const duration = Number(progress.duration) || 0;
  if (!duration || currentTime < 10) {
    return "";
  }

  const percent = Math.min(99, Math.round((currentTime / duration) * 100));
  return percent >= 2 ? `${percent}% watched` : "";
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

startLink.href = episodeUrl(series.episodes[0]);

episodeList.innerHTML = series.episodes
  .map(
    (episode, i) => {
      const available = isEpisodeAvailable(episode);
      const watchStatus = progressLabel(episode);
      const isWatched = watchStatus === "Watched";
      const tagName = available ? "a" : "article";
      const href = available ? ` href="${episodeUrl(episode)}"` : "";
      return `
      <${tagName} class="episode-card reveal-anim ${available ? "" : "is-unavailable"} ${isWatched ? "is-watched" : ""}" style="--reveal-delay:${Math.min(i, 8) * 40}ms"${href}>
        <img
          src="${episodeThumbnailUrl(episode)}"
          alt=""
          loading="lazy"
        />
        <div class="episode-info">
          <span class="episode-number">
            Episode ${episode.number}
            ${episode.recap ? '<span class="recap-badge">Recap</span>' : ""}
            ${isWatched ? '<span class="recap-badge watched-badge">Watched</span>' : ""}
            ${available ? "" : '<span class="recap-badge muted-badge">Uploading soon</span>'}
          </span>
          <strong>${episode.title}</strong>
          <span class="episode-date">${formatDate(episode.published)}</span>
          ${episode.views ? `<span class="episode-views">${formatViews(episode.views)}</span>` : ""}
          ${watchStatus && !isWatched ? `<span class="episode-status">${watchStatus}</span>` : ""}
          ${available ? "" : `<span class="episode-status">${episode.statusNote || "Video not added yet. It will be uploaded in the future."}</span>`}
        </div>
      </${tagName}>
    `;
    },
  )
  .join("");
