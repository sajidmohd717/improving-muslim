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

function renderHero() {
  const eyebrow = document.querySelector(".series-hero .eyebrow");
  const heading = document.querySelector(".series-hero h1");
  const thumbnail = document.querySelector(".series-hero img");
  const episodesEyebrow = document.querySelector("#episodes .eyebrow");
  if (eyebrow) eyebrow.textContent = series.topic || "";
  if (heading) heading.textContent = series.title;
  if (thumbnail) {
    thumbnail.src = series.thumbnailSrc;
    thumbnail.alt = `${series.title} series thumbnail`;
  }
  if (episodesEyebrow) episodesEyebrow.textContent = `${series.episodes.length} episodes`;
}
renderHero();
const SAVED_KEY = "improving-muslim:saved-items";

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

function readSavedItems() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
  } catch {
    return [];
  }
}

function writeSavedItems(items) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function seriesUrl() {
  return series.seriesPageUrl || `./pages/series-${series.slug}.html`;
}

function isSeriesSaved() {
  return readSavedItems().some((item) => item.key === `series:${seriesUrl()}`);
}

function updateSeriesSaveButton(button) {
  const saved = isSeriesSaved();
  button.textContent = saved ? "Saved" : "Save for later";
  button.setAttribute("aria-pressed", String(saved));
}

function toggleSavedSeries(button, status) {
  const item = {
    key: `series:${seriesUrl()}`,
    type: "series",
    title: series.title,
    subtitle: `${series.speaker} - ${series.episodes.length} episodes`,
    url: seriesUrl(),
    savedAt: Date.now(),
  };
  const items = readSavedItems();
  const existing = items.findIndex((saved) => saved.key === item.key);
  const nextItems =
    existing >= 0
      ? items.filter((saved) => saved.key !== item.key)
      : [item, ...items.filter((saved) => saved.key !== item.key)].slice(0, 60);

  if (writeSavedItems(nextItems)) {
    updateSeriesSaveButton(button);
    status.textContent = existing >= 0 ? "Removed from saved items." : "Saved for later on this device.";
  } else {
    status.textContent = "Could not save on this device.";
  }
}

async function shareSeries(status) {
  const url = new URL(seriesUrl(), document.baseURI).href;
  const shareData = {
    title: series.title,
    text: `${series.title} by ${series.speaker}`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      status.textContent = "Share sheet opened.";
      return;
    }

    await navigator.clipboard.writeText(url);
    status.textContent = "Series link copied.";
  } catch {
    status.textContent = "Could not share from this browser.";
  }
}

function renderSeriesActions() {
  const hero = startLink?.parentElement;
  if (!hero) return;

  const actions = document.createElement("div");
  actions.className = "series-utility-actions";
  actions.innerHTML = `
    <button class="quiet-link utility-button" id="save-series-button" type="button" aria-pressed="false">Save for later</button>
    <button class="quiet-link utility-button" id="share-series-button" type="button">Share series</button>
    <p class="action-status" id="series-action-status" role="status"></p>
  `;
  startLink.insertAdjacentElement("afterend", actions);

  const saveButton = actions.querySelector("#save-series-button");
  const shareButton = actions.querySelector("#share-series-button");
  const status = actions.querySelector("#series-action-status");
  updateSeriesSaveButton(saveButton);
  saveButton.addEventListener("click", () => toggleSavedSeries(saveButton, status));
  shareButton.addEventListener("click", () => shareSeries(status));
}

const firstAvailableEpisode = series.episodes.find(isEpisodeAvailable);
if (firstAvailableEpisode) {
  startLink.href = episodeUrl(firstAvailableEpisode);
} else {
  startLink.textContent = "Episodes uploading soon";
  startLink.removeAttribute("href");
  startLink.setAttribute("aria-disabled", "true");
}
renderSeriesActions();

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
          onerror="this.onerror=null;this.src='${series.thumbnailSrc || './public/icon.png'}'"
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
