(function () {
  const SAVED_KEY = "improving-muslim:saved-items";
  const PROGRESS_PREFIX = "lecture-progress:";
  const NOTES_PREFIX = "lecture-notes:";
  const STREAK_KEY = "improving-muslim:study-streak";
  // Fixed for everyone (not user-selectable) so the leaderboard's day counts
  // are directly comparable -- a 20-min learner and a 40-min learner used to
  // rank against each other unevenly.
  const DEFAULT_STREAK_TARGET_MINUTES = 15;
  const FREEZE_MILESTONE_DAYS = 7; // earn 1 streak freeze every N consecutive days
  const MAX_BANKED_FREEZES = 2; // matches Duolingo's cap
  const STREAK_RANKS = [
    { name: "Platinum", min: 40 },
    { name: "Silver", min: 20 },
    { name: "Bronze", min: 10 },
    { name: "Iron", min: 5 },
  ];

  function getStreakRank(days) {
    return STREAK_RANKS.find((rank) => (Number(days) || 0) >= rank.min) || null;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatViewCount(n) {
    if (!n) return "";
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M views`;
    if (n >= 10_000) return `${Math.round(n / 1_000)}K views`;
    if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K views`;
    return `${n} views`;
  }

  function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const restMins = mins % 60;
      return `${hours}:${String(restMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function isEpisodeAvailable(episode) {
    return Boolean(episode?.videoSrc || episode?.youtubeId);
  }

  function seriesUrl(series) {
    return series?.slug ? `./series/${encodeURIComponent(series.slug)}/` : "./pages/series.html";
  }

  function episodeUrl(series, episode) {
    if (!episode?.videoSrc && episode?.youtubeId) {
      return `https://www.youtube.com/watch?v=${episode.youtubeId}`;
    }
    return `./watch/${encodeURIComponent(series.slug)}/${encodeURIComponent(episode.id)}/`;
  }

  function standaloneLectureUrl(lecture) {
    return `./watch/standalone/${encodeURIComponent(lecture.id)}/`;
  }

  function episodeThumbnailUrl(series, episode) {
    if (episode?.thumbnailSrc) return episode.thumbnailSrc;
    if (series?.episodeThumbnailPath && episode?.number) {
      return `${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`;
    }
    return series?.thumbnailSrc || "./public/icon.png";
  }

  function standaloneLectureThumbnailUrl(lecture) {
    return lecture?.thumbnailSrc || "./public/social-preview.png";
  }

  function progressKey(series, episode) {
    return `${PROGRESS_PREFIX}${series.playlistId}:${episode.id}`;
  }

  function standaloneProgressKey(lecture) {
    return `${PROGRESS_PREFIX}standalone:${lecture.id}`;
  }

  function notesKey(series, episode) {
    return `${NOTES_PREFIX}${series.playlistId}:${episode.id}`;
  }

  function standaloneNotesKey(lecture) {
    return `${NOTES_PREFIX}standalone:${lecture.id}`;
  }

  function readJsonStorage(key, fallback = {}) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Notify cloud sync if a user is signed in
      if (window.IMAuth) window.IMAuth.onLocalWrite(key);
      return true;
    } catch {
      return false;
    }
  }

  function removeStorageItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function storageKeysWithPrefix(prefix) {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
    } catch {
      return keys;
    }
    return keys;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(dateKey, days) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    if (!year || !month || !day) return "";
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    return localDateKey(date);
  }

  function isYesterday(dateKey, todayKey = localDateKey()) {
    return addDays(dateKey, 1) === todayKey;
  }

  function daysBetween(fromKey, toKey) {
    const [fy, fm, fd] = String(fromKey || "").split("-").map(Number);
    const [ty, tm, td] = String(toKey || "").split("-").map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
    const from = new Date(fy, fm - 1, fd);
    const to = new Date(ty, tm - 1, td);
    return Math.round((to - from) / 86_400_000);
  }

  function normalizeStreak(raw = {}) {
    const today = localDateKey();
    const targetMinutes = DEFAULT_STREAK_TARGET_MINUTES;
    const targetSeconds = targetMinutes * 60;
    const todaySeconds = raw.todayDate === today ? Math.max(0, Number(raw.todaySeconds) || 0) : 0;
    let lastCompletedDate = raw.lastCompletedDate || "";
    let current = Math.max(0, Number(raw.current) || 0);
    let freezesAvailable = Math.max(0, Math.min(MAX_BANKED_FREEZES, Number(raw.freezesAvailable) || 0));
    let freezeMilestonesClaimed = Math.max(0, Number(raw.freezeMilestonesClaimed) || 0);

    // Streak freeze: a short gap since the last completed day is silently
    // covered by banked freezes instead of breaking the streak, as long as
    // there are enough of them (one freeze per missed day).
    const stillContinuous = lastCompletedDate === today || isYesterday(lastCompletedDate, today);
    if (!stillContinuous && lastCompletedDate) {
      const gap = daysBetween(lastCompletedDate, today) - 1;
      if (gap > 0 && gap <= freezesAvailable && current > 0) {
        freezesAvailable -= gap;
        lastCompletedDate = addDays(today, -1);
      } else {
        current = 0;
        freezeMilestonesClaimed = 0; // a fresh streak earns milestones from day 1 again
      }
    } else if (!stillContinuous) {
      current = 0;
      freezeMilestonesClaimed = 0;
    }

    // When the fixed goal is lowered, credit someone who has already reached
    // the new threshold today without making them watch another second first.
    if (todaySeconds >= targetSeconds && lastCompletedDate !== today) {
      current = isYesterday(lastCompletedDate, today) ? current + 1 : 1;
      lastCompletedDate = today;
    }

    // Grant any newly-crossed 7-day milestones. The milestone still counts as
    // "claimed" even if the bank was already full, so it isn't re-granted later.
    const milestonesEarned = Math.floor(current / FREEZE_MILESTONE_DAYS);
    if (milestonesEarned > freezeMilestonesClaimed) {
      freezesAvailable = Math.min(MAX_BANKED_FREEZES, freezesAvailable + (milestonesEarned - freezeMilestonesClaimed));
      freezeMilestonesClaimed = milestonesEarned;
    }

    const days = {};
    const sourceDays = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(sourceDays)
      .sort()
      .slice(-90)
      .forEach((dateKey) => {
        const day = sourceDays[dateKey] || {};
        const seconds = Math.max(0, Number(day.seconds) || 0);
        days[dateKey] = {
          seconds,
          completed: Boolean(day.completed) || seconds >= targetSeconds,
        };
      });

    if (todaySeconds > 0 || lastCompletedDate === today) {
      days[today] = {
        seconds: todaySeconds,
        completed: todaySeconds >= targetSeconds || lastCompletedDate === today,
      };
    }

    return {
      targetMinutes,
      todayDate: today,
      todaySeconds,
      current,
      best: Math.max(0, Number(raw.best) || 0, current),
      lastCompletedDate,
      days,
      freezesAvailable,
      freezeMilestonesClaimed,
      publicOptIn: Boolean(raw.publicOptIn),
      publicName: raw.publicName || "",
      updatedAt: Number(raw.updatedAt) || 0,
      targetUpdatedAt: Number(raw.targetUpdatedAt) || 0,
    };
  }

  function readStudyStreak() {
    const raw = readJsonStorage(STREAK_KEY, {});
    const normalized = normalizeStreak(raw);
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      writeJsonStorage(STREAK_KEY, normalized);
    }
    return normalized;
  }

  function writeStudyStreak(streak) {
    return writeJsonStorage(STREAK_KEY, normalizeStreak(streak));
  }

  function recordStudySeconds(seconds) {
    const amount = Math.max(0, Math.min(Number(seconds) || 0, 300));
    if (!amount) return readStudyStreak();

    const today = localDateKey();
    const streak = readStudyStreak();
    if (streak.todayDate !== today) {
      streak.todayDate = today;
      streak.todaySeconds = 0;
      if (streak.lastCompletedDate !== today && !isYesterday(streak.lastCompletedDate, today)) {
        streak.current = 0;
      }
    }

    const targetSeconds = streak.targetMinutes * 60;
    const wasComplete = streak.todaySeconds >= targetSeconds || streak.lastCompletedDate === today;
    streak.todaySeconds = Math.max(0, streak.todaySeconds + amount);

    if (!wasComplete && streak.todaySeconds >= targetSeconds) {
      streak.current = isYesterday(streak.lastCompletedDate, today) ? streak.current + 1 : 1;
      streak.best = Math.max(streak.best, streak.current);
      streak.lastCompletedDate = today;
    }

    streak.days[today] = {
      seconds: streak.todaySeconds,
      completed: streak.todaySeconds >= targetSeconds || streak.lastCompletedDate === today,
    };
    streak.updatedAt = Date.now();
    writeStudyStreak(streak);
    return streak;
  }

  function readSavedItems() {
    return readJsonStorage(SAVED_KEY, []);
  }

  function writeSavedItems(items) {
    return writeJsonStorage(SAVED_KEY, items);
  }

  function getAllSeries() {
    return (window.seriesConfig || []).map((entry) => window[entry.globalKey]).filter(Boolean);
  }

  function getStandaloneLectures() {
    return window.standaloneLectures || [];
  }

  function getStandaloneLectureRegistry() {
    const registry = {};
    for (const lecture of getStandaloneLectures()) {
      registry[lecture.id] = lecture;
    }
    return registry;
  }

  function getSeriesRegistry() {
    const registry = {};
    for (const entry of window.seriesConfig || []) {
      if (window[entry.globalKey]) registry[entry.slug] = window[entry.globalKey];
    }
    return registry;
  }

  const imageMap = {
    whyMe: "./assets/thumbnail/heart-softeners/whyme.jpg",
    angels1: "./assets/thumbnail/angels-in-your-presence/episodes/episode-01.jpg",
    changeofheart: "./assets/thumbnail/heart-softeners/changeofheart-card.jpg",
    seerahYasirQadhi: "./assets/thumbnail/life-of-prophet-muhammad/seerah-yasir.jpg",
    seerahMufti: "./assets/thumbnail/life-of-prophet-muhammad/seerah-mufti.jpg",
    fortress: "./assets/thumbnail/hadith/fortress.jpg",
    fatihahTafsirYQ: "./assets/thumbnail/tafsir/fatihah-yq.jpg",
    baqarahTafsirMustafa: "./assets/thumbnail/tafsir/baqarah-mustafa.jpg",
    enjoyYourPrayer: "./assets/thumbnail/salah/enjoy-your-prayer-card.jpg",
    fortyHadithNawawi: "./assets/thumbnail/forty-hadith-nawawi/episodes/episode-01.jpg",
    tenPromisedJannah: "./assets/thumbnail/ten-promised-jannah/episodes/episode-01.jpg",
  };

  window.IMUtils = {
    SAVED_KEY,
    PROGRESS_PREFIX,
    NOTES_PREFIX,
    STREAK_KEY,
    DEFAULT_STREAK_TARGET_MINUTES,
    FREEZE_MILESTONE_DAYS,
    MAX_BANKED_FREEZES,
    STREAK_RANKS,
    getStreakRank,
    escapeHtml,
    formatViewCount,
    formatViews: formatViewCount,
    formatDuration,
    isEpisodeAvailable,
    seriesUrl,
    episodeUrl,
    standaloneLectureUrl,
    episodeThumbnailUrl,
    standaloneLectureThumbnailUrl,
    progressKey,
    standaloneProgressKey,
    notesKey,
    standaloneNotesKey,
    readJsonStorage,
    writeJsonStorage,
    removeStorageItem,
    storageKeysWithPrefix,
    localDateKey,
    readStudyStreak,
    writeStudyStreak,
    recordStudySeconds,
    readSavedItems,
    writeSavedItems,
    getAllSeries,
    getStandaloneLectures,
    getStandaloneLectureRegistry,
    getSeriesRegistry,
    imageMap,
  };
})();
