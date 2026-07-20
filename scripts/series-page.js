(function () {
  const params = new URLSearchParams(window.location.search);
  const seriesId = params.get("id") || document.body?.dataset.seriesId;
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
    const { formatViews, formatDuration, readJsonStorage, writeJsonStorage, readSavedItems, writeSavedItems } = window.IMUtils;
    const episodeList = document.querySelector("#episode-list");
    const heroContent = document.querySelector(".series-hero > div");
    const episodeUrl = (episode) => window.IMUtils.episodeUrl(series, episode);
    const isEpisodeAvailable = window.IMUtils.isEpisodeAvailable;
    const episodeThumbnailUrl = (episode) => window.IMUtils.episodeThumbnailUrl(series, episode);
    const progressKey = (episode) => window.IMUtils.progressKey(series, episode);

    const availableEpisodes = series.episodes.filter(isEpisodeAvailable);
    const totalEpisodes = series.episodes.length;
    const hasUnavailable = availableEpisodes.length < totalEpisodes;
    const showFilters = totalEpisodes >= 10 || hasUnavailable;

    // Partially uploaded series should open on what the learner can watch now.
    // The full roadmap remains one tap away in the All filter.
    let activeFilter = hasUnavailable ? "available" : "all";

    function renderHero() {
      heroContent?.querySelectorAll(".series-cta-row, .series-progress-summary, .series-avail-note, .card-actions").forEach((node) => node.remove());
      const eyebrow = document.querySelector(".series-hero .eyebrow");
      const heading = document.querySelector(".series-hero h1");
      const heroCopy = document.querySelector(".series-hero .hero-copy");
      const thumbnail = document.querySelector(".series-hero img");
      const episodesEyebrow = document.getElementById("episodes-eyebrow");
      if (eyebrow) eyebrow.textContent = series.topic || "";
      if (heading) heading.textContent = series.title;
      if (heroCopy) heroCopy.textContent = series.description || "";
      if (thumbnail) {
        thumbnail.src = series.thumbnailSrc;
        thumbnail.alt = `${series.title} series thumbnail`;
      }
      if (episodesEyebrow) {
        episodesEyebrow.textContent = hasUnavailable
          ? `${availableEpisodes.length} of ${totalEpisodes} available`
          : `${totalEpisodes} episodes`;
      }
      document.title = `${series.title} | Improving Muslim`;
    }
    renderHero();

    function readProgress(episode) {
      return readJsonStorage(progressKey(episode), {});
    }

    function watchedCount() {
      return availableEpisodes.filter(ep => readProgress(ep).completed).length;
    }

    function findResumeEpisode() {
      let best = null, latestAt = 0;
      for (const ep of availableEpisodes) {
        const p = readProgress(ep);
        if (p.completed) continue;
        const t = Number(p.currentTime) || 0;
        const at = Number(p.updatedAt) || 0;
        if (t >= 10 && at > latestAt) { latestAt = at; best = ep; }
      }
      return best;
    }

    function findFirstUnwatched() {
      return availableEpisodes.find(ep => !readProgress(ep).completed) || null;
    }

    function renderHeroCta() {
      if (!heroContent || !availableEpisodes.length) return;
      const resumeEp = findResumeEpisode();
      const targetEp = resumeEp || findFirstUnwatched();
      if (!targetEp) return; // all watched — no CTA needed

      const isResume = Boolean(resumeEp);
      const label = isResume ? `Resume · Episode ${resumeEp.number}` : "Start watching";
      const url = episodeUrl(targetEp);
      const playIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

      const row = document.createElement("div");
      row.className = "series-cta-row";
      row.innerHTML = `<a class="series-cta-btn" href="${url}">${playIcon}${label}</a>`;
      heroContent.appendChild(row);
    }

    function renderProgressSummary() {
      if (!heroContent || !availableEpisodes.length) return;
      const watched = watchedCount();
      if (!watched) return; // nothing watched yet — no summary needed
      const total = availableEpisodes.length;
      const p = document.createElement("p");
      p.className = "series-progress-summary";
      p.textContent = watched >= total
        ? `All ${total} available episodes watched`
        : `${watched} of ${total} available episodes watched`;
      heroContent.appendChild(p);
    }

    function renderAvailabilityNote() {
      if (!heroContent) return;
      const avail = config.availableCount ?? availableEpisodes.length;
      const total = config.episodeCount ?? totalEpisodes;
      if (avail >= total) return; // fully available — no note needed
      const p = document.createElement("p");
      p.className = "series-avail-note";
      p.textContent = `${avail} of ${total} episodes available now. More are being uploaded.`;
      heroContent.appendChild(p);
    }

    function filteredEpisodes() {
      switch (activeFilter) {
        case "available":  return series.episodes.filter(isEpisodeAvailable);
        case "unwatched":  return series.episodes.filter(ep => isEpisodeAvailable(ep) && !readProgress(ep).completed);
        case "watched":    return series.episodes.filter(ep => readProgress(ep).completed);
        default:           return series.episodes;
      }
    }

    function renderEpisodeFilters() {
      const row = document.getElementById("episode-filters-row");
      if (!row || !showFilters) return;

      const filters = [
        { value: "all",       label: `All (${totalEpisodes})` },
        { value: "available", label: `Available (${availableEpisodes.length})` },
        { value: "unwatched", label: "Unwatched" },
        { value: "watched",   label: "Watched" },
      ];

      row.className = "ep-filter-row";
      row.innerHTML = filters.map(f => `
        <button class="ep-filter-btn${f.value === activeFilter ? " is-active" : ""}" type="button" data-filter="${f.value}">
          ${f.label}
        </button>
      `).join("");

      row.addEventListener("click", e => {
        const btn = e.target.closest(".ep-filter-btn");
        if (!btn) return;
        activeFilter = btn.dataset.filter;
        row.querySelectorAll(".ep-filter-btn").forEach(b => b.classList.toggle("is-active", b === btn));
        renderEpisodeList();
      });
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
      return window.IMUtils.seriesUrl(series);
    }

    function isSeriesSaved() {
      return readSavedItems().some((item) => item.key === `series:${currentSeriesUrl()}`);
    }

    function updateSeriesSaveButton(button) {
      const saved = isSeriesSaved();
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", saved ? "Remove from saved" : "Save series");
      const label = button.querySelector("span");
      if (label) label.textContent = saved ? "Saved" : "Save";
    }

    function toggleSavedSeries(button, status) {
      const item = {
        key: `series:${currentSeriesUrl()}`,
        type: "series",
        title: series.title,
        subtitle: hasUnavailable
          ? `${series.speaker} - ${availableEpisodes.length} available · ${totalEpisodes} total`
          : `${series.speaker} - ${totalEpisodes} episodes`,
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
        <button class="mini-action labeled-action" id="save-series-button" type="button" aria-pressed="false" aria-label="Save series">${saveIcon}<span>Save</span></button>
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

    renderHeroCta();
    renderProgressSummary();
    renderAvailabilityNote();
    renderSeriesActions();
    renderEpisodeFilters();

    /* ── Episode list rendering ─────────────────────────────────────────── */

    const dotsIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>`;

    let isFirstRender = true;

    function episodeDuration(episode) {
      if (episode.duration) return formatDuration(episode.duration);
      const stored = Number(readProgress(episode).duration) || 0;
      return stored > 0 ? formatDuration(stored) : "";
    }

    function renderEpisodeCard(episode, i) {
      const available = isEpisodeAvailable(episode);
      const isYouTubeOnly = !episode.videoSrc && Boolean(episode.youtubeId);
      const watchStatus = progressLabel(episode);
      const isWatched = watchStatus === "Watched";
      const href = available ? ` href="${episodeUrl(episode)}"` : "";
      const targetAttr = isYouTubeOnly ? ' target="_blank" rel="noopener noreferrer"' : "";
      const animClass = isFirstRender && available ? "reveal-anim" : "";
      const revealDelay = isFirstRender ? ` style="--reveal-delay:${Math.min(i, 8) * 40}ms"` : "";
      const durText = episodeDuration(episode);
      const content = `
        <img
          src="${episodeThumbnailUrl(episode)}"
          alt=""
          loading="lazy"
          onerror="this.onerror=null;this.src='${series.thumbnailSrc || "./public/icon.png"}'"
        />
        <div class="episode-info">
          <span class="episode-number">
            Episode ${episode.number}
            ${episode.recap ? '<span class="recap-badge">Recap</span>' : ""}
            ${isWatched ? '<span class="recap-badge watched-badge">Watched</span>' : ""}
            ${isYouTubeOnly ? '<span class="recap-badge">YouTube</span>' : available ? "" : '<span class="recap-badge muted-badge">Uploading soon</span>'}
          </span>
          <strong>${episode.title}</strong>
          <span class="episode-date">${formatDate(episode.published)}${durText ? ` · ${durText}` : ""}</span>
          ${episode.views ? `<span class="episode-views">${formatViews(episode.views)}</span>` : ""}
          ${watchStatus && !isWatched ? `<span class="episode-status">${watchStatus}</span>` : ""}
          ${available || isYouTubeOnly ? "" : `<span class="episode-status">${episode.statusNote || "Video not added yet. It will be uploaded in the future."}</span>`}
        </div>
      `;

      return `
        <article class="episode-card ${animClass} ${available ? "" : "is-unavailable"} ${isWatched ? "is-watched" : ""}"${revealDelay} data-episode-index="${i}">
          ${available ? `<a class="episode-card-link"${href}${targetAttr}>${content}</a>` : content}
          ${available ? `<button class="ep-menu-btn" type="button" aria-label="Episode options" aria-expanded="false" aria-haspopup="menu" aria-controls="episode-menu-popover">${dotsIcon}</button>` : ""}
        </article>
      `;
    }

    function renderEpisodeList() {
      const episodes = filteredEpisodes();
      if (!episodes.length) {
        episodeList.innerHTML = `<p class="ep-empty-state">No episodes match this filter.</p>`;
      } else {
        episodeList.innerHTML = episodes.map(renderEpisodeCard).join("");
      }
      isFirstRender = false;
    }

    renderEpisodeList();

    /* ── Three-dot episode menu ──────────────────────────────────────────── */

    // Singleton popover appended to body (avoids overflow:hidden clipping issues)
    const popover = document.createElement("div");
    popover.id = "episode-menu-popover";
    popover.className = "ep-menu-popover";
    popover.setAttribute("role", "menu");
    popover.hidden = true;
    popover.innerHTML = `
      <button class="ep-menu-action" type="button" role="menuitem" data-action="mark-unwatched">Mark as unwatched</button>
      <button class="ep-menu-action" type="button" role="menuitem" data-action="mark-watched">Mark as watched</button>
    `;
    document.body.appendChild(popover);

    let activeMenuBtn = null;
    let activeEpisodeIndex = -1;

    function closeMenu(restoreFocus = false) {
      const trigger = activeMenuBtn;
      if (!popover.hidden) {
        popover.hidden = true;
      }
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
      activeMenuBtn = null;
      activeEpisodeIndex = -1;
      if (restoreFocus && trigger) {
        trigger.focus();
      }
    }

    function openMenu(btn, episode, i) {
      const isWatched = readProgress(episode).completed;
      popover.querySelector('[data-action="mark-unwatched"]').hidden = !isWatched;
      popover.querySelector('[data-action="mark-watched"]').hidden = isWatched;

      // Position relative to button using fixed coordinates
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popoverHeight = 80; // rough estimate

      if (spaceBelow >= popoverHeight) {
        popover.style.top = (rect.bottom + 4) + "px";
        popover.style.bottom = "auto";
      } else {
        popover.style.bottom = (window.innerHeight - rect.top + 4) + "px";
        popover.style.top = "auto";
      }

      const rightEdge = window.innerWidth - rect.right;
      popover.style.right = Math.max(8, rightEdge) + "px";
      popover.style.left = "auto";

      popover.hidden = false;
      activeMenuBtn = btn;
      activeEpisodeIndex = i;
      btn.setAttribute("aria-expanded", "true");

      // Focus first visible action for keyboard accessibility
      const firstAction = popover.querySelector(".ep-menu-action:not([hidden])");
      if (firstAction) firstAction.focus();
    }

    // Intercept three-dot button clicks via delegation on the list
    episodeList.addEventListener("click", function (e) {
      const menuBtn = e.target.closest(".ep-menu-btn");
      if (!menuBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const card = menuBtn.closest("[data-episode-index]");
      if (!card) return;

      const i = parseInt(card.dataset.episodeIndex, 10);
      const episode = series.episodes[i];

      if (!popover.hidden && activeMenuBtn === menuBtn) {
        closeMenu();
      } else {
        closeMenu();
        openMenu(menuBtn, episode, i);
      }
    });

    // Handle popover action clicks
    popover.addEventListener("click", function (e) {
      const action = e.target.dataset.action;
      if (!action || activeEpisodeIndex < 0) return;

      const episode = series.episodes[activeEpisodeIndex];
      const key = progressKey(episode);
      const progress = readJsonStorage(key, {});

      if (action === "mark-unwatched") {
        delete progress.completed;
        writeJsonStorage(key, progress);
      } else if (action === "mark-watched") {
        progress.completed = true;
        progress.updatedAt = Date.now();
        writeJsonStorage(key, progress);
      }

      closeMenu();
      renderEpisodeList();
    });

    // Close on outside click
    document.addEventListener("click", function (e) {
      if (popover.hidden) return;
      if (popover.contains(e.target)) return;
      if (e.target.closest(".ep-menu-btn")) return;
      closeMenu();
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !popover.hidden) {
        closeMenu(true);
      }
    });
  }
})();
