(function () {
  const SAVED_KEY = "improving-muslim:saved-items";
  const PROGRESS_PREFIX = "lecture-progress:";

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
    return Boolean(episode?.videoSrc);
  }

  function episodeUrl(series, episode) {
    return `./pages/watch.html?series=${encodeURIComponent(series.slug)}&video=${encodeURIComponent(episode.id)}`;
  }

  function standaloneLectureUrl(lecture) {
    return `./pages/watch.html?lecture=${encodeURIComponent(lecture.id)}`;
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
    heartmatters: "./assets/thumbnail/heart-matters/episodes/episode-01.jpg",
    messageQuran: "./assets/thumbnail/message-of-the-quran/episodes/episode-01.jpg",
    parablesQuran: "./assets/thumbnail/parables-of-the-quran/episodes/episode-01.jpg",
    wisdomsQuran: "./assets/thumbnail/general-quran-tafsir/wisdoms-quran.jpg",
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
    escapeHtml,
    formatViewCount,
    formatViews: formatViewCount,
    formatDuration,
    isEpisodeAvailable,
    episodeUrl,
    standaloneLectureUrl,
    episodeThumbnailUrl,
    standaloneLectureThumbnailUrl,
    progressKey,
    standaloneProgressKey,
    readJsonStorage,
    writeJsonStorage,
    removeStorageItem,
    storageKeysWithPrefix,
    readSavedItems,
    writeSavedItems,
    getAllSeries,
    getStandaloneLectures,
    getStandaloneLectureRegistry,
    getSeriesRegistry,
    imageMap,
  };
})();
