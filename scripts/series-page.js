(function () {
  const params = new URLSearchParams(window.location.search);
  const seriesId = params.get("id");
  const config = (window.seriesConfig || []).find((c) => c.slug === seriesId);

  if (!config) {
    window.location.replace("./pages/series.html");
    return;
  }

  const script = document.createElement("script");
  script.src = config.dataFile;
  script.onload = function () {
    const series = window[config.globalKey];
    if (!series) {
      window.location.replace("./pages/series.html");
      return;
    }
    initPage(series);
  };
  script.onerror = function () {
    window.location.replace("./pages/series.html");
  };
  document.head.appendChild(script);

  function initPage(series) {
    const { formatViews, readJsonStorage, readSavedItems, writeSavedItems } = window.IMUtils;
    const episodeList = document.querySelector("#episode-list");
    const heroContent = document.querySelector(".series-hero > div");
    const episodeUrl = (episode) => window.IMUtils.episodeUrl(series, episode);
    const isEpisodeAvailable = window.IMUtils.isEpisodeAvailable;
    const episodeThumbnailUrl = (episode) => window.IMUtils.episodeThumbnailUrl(series, episode);
    const progressKey = (episode) => window.IMUtils.progressKey(series, episode);

    function renderHero() {
      const eyebrow = document.querySelector(".series-hero .eyebrow");
      const heading = document.querySelector(".series-hero h1");
      const heroCopy = document.querySelector(".series-hero .hero-copy");
      const thumbnail = document.querySelector(".series-hero img");
      const episodesEyebrow = document.querySelector("#episodes .eyebrow");
      if (eyebrow) eyebrow.textContent = series.topic || "";
      if (heading) heading.textContent = series.title;
      if (heroCopy) heroCopy.textContent = series.description || "";
      if (thumbnail) {
        thumbnail.src = series.thumbnailSrc;
        thumbnail.alt = `${series.title} series thumbnail`;
      }
      if (episodesEyebrow) episodesEyebrow.textContent = `${series.episodes.length} episodes`;
      document.title = `${series.title} | Improving Muslim`;
    }
    renderHero();

    function readProgress(episode) {
      return readJsonStorage(progressKey(episode), {});
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

    function currentSeriesUrl() {
      return series.seriesPageUrl || `./pages/series-detail.html?id=${series.slug}`;
    }

    function isSeriesSaved() {
      return readSavedItems().some((item) => item.key === `series:${currentSeriesUrl()}`);
    }

    function updateSeriesSaveButton(button) {
      const saved = isSeriesSaved();
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", saved ? "Remove from saved" : "Save series");
    }

    function toggleSavedSeries(button, status) {
      const item = {
        key: `series:${currentSeriesUrl()}`,
        type: "series",
        title: series.title,
        subtitle: `${series.speaker} - ${series.episodes.length} episodes`,
        url: currentSeriesUrl(),
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
      const url = new URL(currentSeriesUrl(), document.baseURI).href;
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

    const saveIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
    const shareIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;

    function renderSeriesActions() {
      if (!heroContent) return;

      const actions = document.createElement("div");
      actions.className = "card-actions";
      actions.innerHTML = `
        <button class="mini-action icon-btn" id="save-series-button" type="button" aria-pressed="false" aria-label="Save series">${saveIcon}</button>
        <button class="mini-action icon-btn" id="share-series-button" type="button" aria-label="Share series">${shareIcon}</button>
        <p class="action-status" id="series-action-status" role="status"></p>
      `;
      heroContent.appendChild(actions);

      const saveButton = actions.querySelector("#save-series-button");
      const shareButton = actions.querySelector("#share-series-button");
      const status = actions.querySelector("#series-action-status");
      updateSeriesSaveButton(saveButton);
      saveButton.addEventListener("click", () => toggleSavedSeries(saveButton, status));
      shareButton.addEventListener("click", () => shareSeries(status));
    }

    renderSeriesActions();

    episodeList.innerHTML = series.episodes
      .map(
        (episode, i) => {
          const available = isEpisodeAvailable(episode);
          const isYouTubeOnly = !episode.videoSrc && Boolean(episode.youtubeId);
          const watchStatus = progressLabel(episode);
          const isWatched = watchStatus === "Watched";
          const tagName = available ? "a" : "article";
          const href = available ? ` href="${episodeUrl(episode)}"` : "";
          const targetAttr = isYouTubeOnly ? ' target="_blank" rel="noopener noreferrer"' : "";
          return `
          <${tagName} class="episode-card reveal-anim ${available ? "" : "is-unavailable"} ${isWatched ? "is-watched" : ""}" style="--reveal-delay:${Math.min(i, 8) * 40}ms"${href}${targetAttr}>
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
                ${isYouTubeOnly ? '<span class="recap-badge">YouTube</span>' : available ? "" : '<span class="recap-badge muted-badge">Uploading soon</span>'}
              </span>
              <strong>${episode.title}</strong>
              <span class="episode-date">${formatDate(episode.published)}</span>
              ${episode.views ? `<span class="episode-views">${formatViews(episode.views)}</span>` : ""}
              ${watchStatus && !isWatched ? `<span class="episode-status">${watchStatus}</span>` : ""}
              ${available || isYouTubeOnly ? "" : `<span class="episode-status">${episode.statusNote || "Video not added yet. It will be uploaded in the future."}</span>`}
            </div>
          </${tagName}>
        `;
        },
      )
      .join("");
  }
})();
