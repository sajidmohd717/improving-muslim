/*
 * Watch-page sidebar rendering. Exposes window.IMWatchSidebar.
 *
 * Owns everything inside the episode sidebar: the "Up next" card, the compact
 * episode list with progress labels, the mobile now-playing chip and
 * collapsible list, and the catalog-wide related lectures ranked by IMRelated
 * (series pages show related below the episode list; standalone pages use the
 * top result as their "Up next" card). init() returns { relatedUpNextUrl } so
 * watch-page.js can use that top result as the standalone autoplay target.
 *
 * watch-page.js calls IMWatchSidebar.init(context) once the current episode
 * is resolved, and markCurrentWatched() when playback ends. Loaded on the
 * watch template before watch-page.js.
 */
(() => {
  "use strict";

  const { escapeHtml, isEpisodeAvailable, readJsonStorage, PROGRESS_PREFIX } = window.IMUtils;

  const episodeList = document.querySelector("#watch-episode-list");
  const episodeSidebar = document.querySelector(".episode-sidebar");
  const playlistTitle = document.querySelector("#playlist-title");

  function markCurrentWatched() {
    const currentCompactEpisode = episodeList?.querySelector(".compact-episode.is-current");
    if (!currentCompactEpisode) return;
    currentCompactEpisode.classList.add("is-watched");
    const details = currentCompactEpisode.querySelector("span");
    const existingProgress = details?.querySelector("em");
    if (existingProgress) {
      existingProgress.textContent = "Watched";
    } else if (details) {
      details.insertAdjacentHTML("beforeend", "<em>Watched</em>");
    }
  }

  function init({
    series,
    currentEpisode,
    nextEpisode,
    isStandalone,
    catalogKey,
    episodeUrl,
    episodeThumbnailUrl,
    formatProgress,
    currentTypeLabel,
  }) {
    if (playlistTitle) playlistTitle.textContent = isStandalone ? "More lectures" : series.title;

    // Standalone lectures have no episode list, but the sidebar still hosts
    // the catalog-wide related lectures rendered below — hide only the
    // "Playing from" heading and the empty list. If no related lectures can be
    // ranked (e.g. the catalog index failed to load), the related block hides
    // the whole sidebar.
    if (episodeSidebar && isStandalone) {
      episodeSidebar.querySelector(".section-heading")?.setAttribute("hidden", "");
      episodeList.hidden = true;
      episodeSidebar.setAttribute("aria-labelledby", "related-title");
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

    // ── Related lectures ───────────────────────────────────────────────────
    // Catalog-wide "more like this", ranked by IMRelated over the generated
    // catalog index (data/catalog-data.js). Series pages show it below the
    // episode list; standalone pages use the top result as their "Up next"
    // card and (via the returned relatedUpNextUrl) autoplay target.
    let relatedUpNextUrl = null;
    const relatedSection = document.querySelector("#related-section");
    const relatedList = document.querySelector("#related-list");
    const catalogItems = window.catalogIndex?.items || [];

    function hideStandaloneSidebar() {
      if (isStandalone && episodeSidebar) episodeSidebar.hidden = true;
    }

    if (!relatedSection || !relatedList || !window.IMRelated || !catalogItems.length) {
      hideStandaloneSidebar();
      return { relatedUpNextUrl };
    }

    const isWatched = (item) =>
      Boolean(readJsonStorage(`${PROGRESS_PREFIX}${item.playlistId}:${item.id}`, {}).completed);

    // Popularity prior comes from the local cache (instant); refreshCounts()
    // updates that cache in the background for the next page view.
    const popularity = window.IMPopularity ? window.IMPopularity.cachedCounts() : {};
    if (window.IMPopularity) window.IMPopularity.refreshCounts();

    const related = window.IMRelated.rankRelated({
      items: catalogItems,
      currentKey: catalogKey,
      excludeSeries: isStandalone ? null : series.slug,
      isWatched,
      popularity,
      limit: isStandalone ? 9 : 6,
    });

    if (!related.length) {
      hideStandaloneSidebar();
      return { relatedUpNextUrl };
    }

    let listItems = related;
    if (isStandalone) {
      const upNext = related[0];
      listItems = related.slice(1);
      relatedUpNextUrl = upNext.url;
      const mins = upNext.duration ? `${Math.round(upNext.duration / 60)} min` : "";
      const meta = [upNext.speaker, mins].filter(Boolean).join(" · ");
      const upNextCard = document.createElement("a");
      upNextCard.className = "up-next-card";
      upNextCard.href = upNext.url;
      upNextCard.innerHTML = `
        <img src="${escapeHtml(upNext.thumb)}" alt="" loading="lazy" />
        <span class="up-next-body">
          <small>Up next</small>
          <strong>${escapeHtml(upNext.title)}</strong>
          ${meta ? `<em>${escapeHtml(meta)}</em>` : ""}
        </span>
        <span class="up-next-play" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
        </span>
      `;
      episodeSidebar.insertBefore(upNextCard, relatedSection);
    }

    relatedList.innerHTML = listItems
      .map((item) => {
        const context = item.kind === "episode" ? `${item.seriesTitle} · Ep ${item.number}` : item.speaker;
        const mins = item.duration ? `${Math.round(item.duration / 60)} min` : "";
        const meta = [item.kind === "episode" ? item.speaker : "", mins].filter(Boolean).join(" · ");
        const watched = isWatched(item);
        return `
          <a class="compact-episode related-item ${watched ? "is-watched" : ""}" href="${escapeHtml(item.url)}">
            <img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />
            <span>
              <small>${escapeHtml(context)}</small>
              <strong>${escapeHtml(item.title)}</strong>
              ${watched ? "<em>Watched</em>" : meta ? `<em>${escapeHtml(meta)}</em>` : ""}
            </span>
          </a>`;
      })
      .join("");
    relatedSection.hidden = false;

    return { relatedUpNextUrl };
  }

  window.IMWatchSidebar = { init, markCurrentWatched };
})();
