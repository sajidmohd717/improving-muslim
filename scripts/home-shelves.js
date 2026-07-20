/*
 * Homepage shelves outside the main grid: Continue learning, Popular right
 * now, the daily streak card, and the speaker rail. Exposes
 * window.IMHomeShelves. Each renderer queries its own section and hides it
 * when there is nothing to show; script.js calls them at startup and again
 * when history or auth state changes.
 *
 * Loaded on the homepage after utils.js/popularity.js and before script.js.
 */
(() => {
  "use strict";

  const {
    escapeHtml,
    formatDuration,
    getStandaloneLectures,
    readJsonStorage,
    readStudyStreak,
    storageKeysWithPrefix,
    PROGRESS_PREFIX,
  } = window.IMUtils;
  const standaloneLectureUrl = (lecture) => window.IMUtils.standaloneLectureUrl(lecture);
  const standaloneLectureThumbnailUrl = (lecture) => window.IMUtils.standaloneLectureThumbnailUrl(lecture);

  // ── Homepage shelf cards ───────────────────────────────────────────────────
  // Shared card markup for horizontal homepage shelves. metaText is the small
  // line under the title.
  function shelfCardHtml(item, metaText) {
    const context = item.kind === "episode" ? `${item.seriesTitle} · Ep ${item.number}` : item.speaker;
    return `
      <a class="shelf-card" href="${escapeHtml(item.url)}">
        <img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />
        <span class="shelf-card-body">
          <small>${escapeHtml(context)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          ${metaText ? `<em>${escapeHtml(metaText)}</em>` : ""}
        </span>
      </a>`;
  }

  function renderContinueWatching() {
    const continueSection = document.querySelector("#continue-section");
    const continueList = document.querySelector("#continue-list");
    if (!continueSection || !continueList) {
      return;
    }

    const allProgressKeys = storageKeysWithPrefix(PROGRESS_PREFIX);

    const items = allProgressKeys.map((key) => {
      try {
        const stored = readJsonStorage(key, {});
        if (!stored.updatedAt || !stored.duration) return null;
        const currentTime = Math.max(0, Number(stored.currentTime) || 0);
        const duration = Math.max(1, Number(stored.duration));
        const percent = Math.min(1, currentTime / duration);
        const progress = { currentTime, duration, percent, updatedAt: Number(stored.updatedAt) || 0 };

        if (stored._card) {
          return { progress, key, ...stored._card };
        }

        // Fallback for legacy standalone saves that predate _card
        if (key.includes(":standalone:")) {
          const lectureId = key.split(":standalone:")[1];
          const lecture = getStandaloneLectures().find((l) => l.id === lectureId);
          if (!lecture || !lecture.videoSrc) return null;
          return {
            progress,
            key,
            eyebrow: `${lecture.speaker} - Standalone video`,
            title: lecture.title,
            thumbnail: standaloneLectureThumbnailUrl(lecture),
            url: standaloneLectureUrl(lecture),
          };
        }

        return null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.progress.updatedAt - a.progress.updatedAt)
    .slice(0, 4);

    // Returning visitors get a compact hero so resuming is closer to the fold.
    document.body.classList.toggle("has-watch-history", items.length > 0);

    // New visitors see the catalogue first; the section only appears once
    // there is something to resume.
    if (!items.length) {
      continueSection.hidden = true;
      continueList.innerHTML = "";
      return;
    }
    continueSection.hidden = false;

    const removeButton = `
      <button class="continue-remove" type="button" aria-label="Remove from watch history">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;

    const [heroItem, ...restItems] = items;
    const heroPercent = Math.round(heroItem.progress.percent * 100);
    const heroMinutesLeft = Math.max(1, Math.round((heroItem.progress.duration - heroItem.progress.currentTime) / 60));
    const heroCard = `
      <div class="continue-card continue-hero reveal-anim" data-progress-key="${escapeHtml(heroItem.key)}">
        <a class="continue-card-link" href="${heroItem.url}">
          <div class="continue-thumb">
            <img src="${heroItem.thumbnail}" alt="" />
            <div class="continue-bar" role="img" aria-label="${heroPercent}% watched">
              <span style="width:${heroPercent}%"></span>
            </div>
          </div>
          <div class="continue-body">
            <small>${escapeHtml(heroItem.eyebrow)}</small>
            <strong>${escapeHtml(heroItem.title)}</strong>
            <em>Resume at ${formatDuration(heroItem.progress.currentTime)} · ${heroMinutesLeft} min left</em>
            <span class="continue-resume-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              Resume
            </span>
          </div>
        </a>
        ${removeButton}
      </div>
    `;

    const compactCards = restItems
      .map((item, i) => {
        const { progress, key } = item;
        const percent = Math.round(progress.percent * 100);
        return `
          <div class="continue-card reveal-anim" style="--reveal-delay:${(i + 1) * 50}ms" data-progress-key="${escapeHtml(key)}">
            <a class="continue-card-link" href="${item.url}">
              <div class="continue-thumb">
                <img src="${item.thumbnail}" alt="" loading="lazy" />
                <div class="continue-ring" role="img" aria-label="${percent}% watched">
                  <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
                    <circle class="ring-track" cx="18" cy="18" r="15.9"/>
                    <circle class="ring-fill" cx="18" cy="18" r="15.9"
                      stroke-dasharray="${percent} 100"
                      stroke-dashoffset="25"/>
                  </svg>
                </div>
              </div>
              <div class="continue-body">
                <small>${escapeHtml(item.eyebrow)}</small>
                <strong>${escapeHtml(item.title)}</strong>
                <em>Resume at ${formatDuration(progress.currentTime)}</em>
              </div>
            </a>
            ${removeButton}
          </div>
        `;
      })
      .join("");

    continueList.innerHTML = heroCard + compactCards;
  }

  // "Popular right now": anonymous play counts from the popularity Worker,
  // shown to everyone — it is the one personalization-free shelf, so brand-new
  // visitors get social proof even with no watch history. Hidden until the
  // Worker is deployed and enough plays accumulate.
  function renderPopularShelf() {
    const section = document.querySelector("#popular-section");
    const list = document.querySelector("#popular-list");
    if (!section || !list || !window.IMPopularity) return;
    const catalogItems = window.catalogIndex?.items || [];
    if (!catalogItems.length) return;

    window.IMPopularity.refreshCounts().then((counts) => {
      const ranked = catalogItems
        .map((item) => ({ item, plays: counts[item.key]?.p || 0 }))
        .filter(({ plays }) => plays >= 2)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 8);

      // A "popular" shelf with one or two entries reads as noise, not signal.
      if (ranked.length < 4) {
        section.hidden = true;
        list.innerHTML = "";
        return;
      }

      list.innerHTML = ranked
        .map(({ item, plays }) => {
          const mins = item.duration ? `${Math.round(item.duration / 60)} min` : "";
          return shelfCardHtml(item, [`${plays} plays`, mins].filter(Boolean).join(" · "));
        })
        .join("");
      section.hidden = false;
    });
  }

  function renderStudyStreak() {
    const streakSection = document.querySelector("#streak-section");
    const streakCard = document.querySelector("#streak-card");
    if (!streakSection || !streakCard || !readStudyStreak) {
      return;
    }

    const streak = readStudyStreak();
    const targetSeconds = streak.targetMinutes * 60;
    const todaySeconds = Math.min(streak.todaySeconds, targetSeconds);
    const percent = targetSeconds > 0 ? Math.min(100, Math.round((todaySeconds / targetSeconds) * 100)) : 0;
    const watchedMinutes = Math.floor(todaySeconds / 60);
    const minutesLeft = Math.max(0, Math.ceil((targetSeconds - todaySeconds) / 60));
    const hasStarted = streak.current > 0 || streak.best > 0 || streak.todaySeconds > 0;

    if (!hasStarted) {
      streakSection.hidden = true;
      streakCard.innerHTML = "";
      return;
    }

    const isComplete = todaySeconds >= targetSeconds;
    const streakLabel = `${streak.current} day${streak.current === 1 ? "" : "s"}`;
    const progressText = isComplete ? "Daily goal complete" : `${minutesLeft} min left today`;
    const continueHref = document.querySelector(".continue-card-link")?.getAttribute("href") || "./index.html#series";

    streakSection.hidden = false;
    streakCard.innerHTML = `
      <div class="streak-orb" style="--streak-progress:${percent}%">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2s4 4.4 4 8a4 4 0 0 1-8 0c0-1.9 1.1-3.4 2.2-4.7"/>
          <path d="M6.6 10.8A7 7 0 1 0 18 8c.4 1.8-.1 3.4-1.1 4.5"/>
        </svg>
        <strong>${streak.current}</strong>
      </div>
      <div class="streak-copy">
        <small>Daily learning streak</small>
        <h2 id="streak-title">${isComplete ? `${streakLabel} strong` : `${streakLabel} in progress`}</h2>
        <p>${watchedMinutes} of ${streak.targetMinutes} minutes watched today. ${escapeHtml(progressText)}.</p>
        <div class="streak-track" aria-label="${percent}% of today's learning goal complete">
          <span style="width:${percent}%"></span>
        </div>
      </div>
      <div class="streak-stats">
        <span><strong>${streak.best}</strong><small>Best</small></span>
        <a class="streak-action" href="${continueHref}">${isComplete ? "Keep learning" : "Continue"}</a>
      </div>
    `;
  }

  function renderSpeakers() {
    const speakerList = document.querySelector("#speaker-list");
    if (!speakerList) return;
    speakerList.innerHTML = (window.speakers || [])
      .map(
        (speaker, i) => `
          <a class="speaker-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 40}ms" href="./pages/speaker.html?speaker=${encodeURIComponent(speaker.slug)}">
            <img src="${speaker.image}" alt="${escapeHtml(speaker.name)}" loading="lazy" />
            <span>${escapeHtml(speaker.name)}</span>
          </a>
        `,
      )
      .join("");
  }

  window.IMHomeShelves = {
    shelfCardHtml,
    renderContinueWatching,
    renderPopularShelf,
    renderStudyStreak,
    renderSpeakers,
  };
})();
