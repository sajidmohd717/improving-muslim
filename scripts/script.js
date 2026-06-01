const API_ROOT = "https://sajidmohd717.github.io/series-api";

const categories = [
  { name: "All", value: "foryou" },
  { name: "Purification", value: "purification" },
  { name: "Prayer", value: "prayer" },
  { name: "Hadith", value: "hadith" },
  { name: "Seerah", value: "seerah" },
  { name: "Sahaba", value: "sahaba" },
  { name: "Tafsir", value: "tafsir" },
  { name: "Aqeedah", value: "aqeedah" },
  { name: "Prophets", value: "prophets" },
  { name: "Angels", value: "angels" },
  { name: "Arabic", value: "arabic" },
  { name: "Fiqh", value: "fiqh" },
  { name: "Hereafter", value: "hereafter" },
];

const speakers = window.speakers || [];

const excludedSpeakerNames = new Set([
  [117, 116, 104, 109, 97, 110, 32, 105, 98, 110, 32, 102, 97, 114, 111, 111, 113]
    .map((code) => String.fromCharCode(code))
    .join(""),
]);

const imageMap = {
  whyMe: "./assets/thumbnail/heart-softeners/whyme.jpg",
  angels1: "./assets/thumbnail/angels-in-your-presence/episodes/episode-01.jpg",
  changeofheart: "./assets/thumbnail/heart-softeners/changeofheart-card.jpg",
  heartmatters: "./assets/thumbnail/heart-matters/episodes/episode-01.jpg",
  messageQuran: "./assets/thumbnail/general-quran-tafsir/message-quran.jpg",
  parablesQuran: "./assets/thumbnail/general-quran-tafsir/parables-quran.jpg",
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

const fallbackData = [
  {
    sectionTitle: "Hadith",
    seriesList: [
      {
        title: "40 Hadith of Imam Nawawi",
        speaker: "Navaid Aziz",
        episodes: "46 Lectures",
        thumbnailImage: "fortyHadithNawawi",
        link: "./pages/series-forty-hadith-nawawi.html",
        viewcount: "136K views",
      },
    ],
  },
  {
    sectionTitle: "Salah & Worship",
    seriesList: [
      {
        title: "Enjoy Your Prayer",
        speaker: "Ali Hammuda",
        episodes: "21 Lectures",
        thumbnailImage: "enjoyYourPrayer",
        link: "./pages/series-enjoy-your-prayer.html",
        viewcount: "1M views",
      },
    ],
  },
  {
    sectionTitle: "Purification of the Heart",
    seriesList: [
      {
        title: "Change of Heart",
        speaker: "Ali Hammuda",
        episodes: "12 Lectures",
        thumbnailImage: "changeofheart",
        link: "https://www.youtube.com/playlist?list=PL9OPVukugS7xZ-PY008PN6_kGInouP0rz",
        viewcount: "628K views",
      },
      {
        title: "Heart Matters Ramadan Series 2023",
        speaker: "Yasir Qadhi",
        episodes: "26 Lectures",
        thumbnailImage: "heartmatters",
        link: "./pages/series-heart-matters.html",
        viewcount: "749K views",
      },
    ],
  },
  {
    sectionTitle: "Reflection and Contemplation",
    seriesList: [
      {
        title: "Why Me | 2024 Ramadan Series",
        speaker: "Omar Suleiman",
        episodes: "30 Lectures",
        thumbnailImage: "whyMe",
        link: "https://www.youtube.com/playlist?list=PLQ02IYL5pmhFYDrmxNHAlwgcHOR4h1bPa",
        viewcount: "14.3M views",
      },
    ],
  },
  {
    sectionTitle: "General Quran Tafsir",
    seriesList: [
      {
        title: "The Message of the Quran in 30 Lessons",
        speaker: "Yasir Qadhi",
        episodes: "30 Lectures",
        thumbnailImage: "messageQuran",
        link: "https://www.youtube.com/playlist?list=PLYZxc42QNctUnn09Of4rBuakQhu-Q2qpc",
      },
      {
        title: "The Parables of The Quran",
        speaker: "Yasir Qadhi",
        episodes: "29 Lectures",
        thumbnailImage: "parablesQuran",
        link: "https://www.youtube.com/playlist?list=PLYZxc42QNctUIsBRE5XCY6eICwl_W8jnj",
      },
      {
        title: "Wisdoms of The Quran - Ramadan Series 2024",
        speaker: "Yasir Qadhi",
        episodes: "26 Lectures",
        thumbnailImage: "wisdomsQuran",
        link: "https://www.youtube.com/playlist?list=PLYZxc42QNctV2v3RRYwTHdgDHp_h80mJT",
      },
    ],
  },
];

const localCategoryFallbacks = {
  prayer: [fallbackData[1]],
  purification: [fallbackData[2]],
  hadith: [fallbackData[0]],
  seerah: [
    {
      sectionTitle: "Seerah",
      seriesList: [
        {
          title: "Seerah of Prophet Muhammed (S)",
          speaker: "Yasir Qadhi",
          episodes: "104 Lectures",
          thumbnailImage: "seerahYasirQadhi",
          link: "./pages/series-seerah-yasir-qadhi.html",
        },
      ],
    },
  ],
  sahaba: [
    {
      sectionTitle: "Sahaba",
      seriesList: [
        {
          title: "10 Promised Jannah",
          speaker: "AbdulRahman Hassan",
          episodes: "10 Lectures",
          thumbnailImage: "tenPromisedJannah",
          link: "./pages/series-ten-promised-jannah.html",
          viewcount: "174K views",
        },
      ],
    },
  ],
  angels: [
    {
      sectionTitle: "Angels",
      seriesList: [
        {
          title: "Angels in Your Presence",
          speaker: "Omar Suleiman",
          episodes: "30 Lectures",
          thumbnailImage: "angels1",
          link: "./pages/series-angels-in-your-presence.html",
          viewcount: "15.2M views",
        },
      ],
    },
  ],
};

const localFirstCategories = new Set(Object.keys(localCategoryFallbacks));

const descriptions = {
  "Enjoy Your Prayer":
    "A step-by-step journey through salah, helping prayer become more present, meaningful, and loved.",
  "Why Me | 2024 Ramadan Series":
    "A reflective Ramadan series on hardship, divine decree, purpose, and learning to see tests through a more faithful lens.",
  "Change of Heart":
    "A series focused on the inner life: sincerity, repentance, discipline, and the work of returning the heart to Allah.",
  "Heart Matters Ramadan Series 2023":
    "Short daily reminders exploring spiritual diseases, emotional repair, and practical ways to soften the heart.",
  "Angels in Your Presence":
    "A study of angels and how belief in the unseen can reshape worship, character, and daily awareness.",
  "40 Hadith of Imam Nawawi":
    "A structured study of Imam an-Nawawi's foundational hadith collection with lessons for belief, worship, and character.",
  "10 Promised Jannah":
    "A focused series on the ten companions who were promised Jannah, exploring their lives, virtues, sacrifice, and lessons for believers today.",
};

const state = {
  activeCategory: "foryou",
  sections: [],
  searchTerm: "",
  sortBy: "views",
  activeSpeaker: null,
};

const SAVED_KEY = "improving-muslim:saved-items";

function formatViewCount(n) {
  if (!n) return "";
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K views`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

function enrichSeries(item) {
  if (item.title === "Change of Heart" && window.changeOfHeartSeries) {
    const total = window.changeOfHeartSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if (item.title === "Enjoy Your Prayer" && window.enjoyYourPrayerSeries) {
    const total = window.enjoyYourPrayerSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if (item.title === "40 Hadith of Imam Nawawi" && window.fortyHadithSeries) {
    const total = window.fortyHadithSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if ((item.title.includes("Seerah of Prophet") || item.title.includes("Seerah of the Prophet")) && window.seerahYasirQadhiSeries) {
    const total = window.seerahYasirQadhiSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if (item.title === "Heart Matters Ramadan Series 2023" && window.heartMattersSeries) {
    const total = window.heartMattersSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if (item.title.startsWith("Why Me") && window.whyMeSeries) {
    const total = window.whyMeSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if (item.title === "Angels in Your Presence" && window.angelsInYourPresenceSeries) {
    const total = window.angelsInYourPresenceSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  if (item.title === "10 Promised Jannah" && window.tenPromisedJannahSeries) {
    const total = window.tenPromisedJannahSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  return item;
}

function parseViewCount(str) {
  if (!str) return -1;
  const num = parseFloat(str);
  if (/[Mm]/.test(str)) return num * 1_000_000;
  if (/[Kk]/.test(str)) return num * 1_000;
  return num || -1;
}

function getSortedSeries(list) {
  if (state.sortBy === "views") {
    return [...list].sort((a, b) => parseViewCount(b.viewcount) - parseViewCount(a.viewcount));
  }
  if (state.sortBy === "az") {
    return [...list].sort((a, b) => a.title.localeCompare(b.title));
  }
  return list;
}

const els = {
  menuToggle: document.querySelector(".menu-toggle"),
  siteMenu: document.querySelector("#site-menu"),
  speakerList: document.querySelector("#speaker-list"),
  continueSection: document.querySelector("#continue-section"),
  continueList: document.querySelector("#continue-list"),
  categoryList: document.querySelector("#category-list"),
  seriesGrid: document.querySelector("#series-grid"),
  statusMessage: document.querySelector("#status-message"),
  resultCount: document.querySelector("#result-count"),
  searchForm: document.querySelector(".search-form"),
  searchInput: document.querySelector("#series-search"),
  sortSelect: document.querySelector("#sort-select"),
  activeCategoryLabel: document.querySelector("#active-category-label"),
};

function cleanJson(text) {
  return text.replace(/^\uFEFF/, "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSections(sections) {
  return sections.map((section) => ({
    ...section,
    seriesList: section.seriesList.map((series) => ({
      ...series,
      topic: section.sectionTitle,
      thumbnailImage: imageMap[series.thumbnailImage] || series.thumbnailImage,
    })),
  }));
}

function flattenSeries(sections) {
  return sections.flatMap((section) => section.seriesList);
}

function isAllowedSeries(series) {
  const speaker = (series.speaker || "").trim().toLowerCase();
  return !excludedSpeakerNames.has(speaker);
}

function availableLocalSeries() {
  return [
    window.changeOfHeartSeries,
    window.enjoyYourPrayerSeries,
    window.fortyHadithSeries,
    window.whyMeSeries,
    window.seerahYasirQadhiSeries,
    window.tenPromisedJannahSeries,
    window.heartMattersSeries,
    window.angelsInYourPresenceSeries,
  ].filter(Boolean);
}

function localSeriesSections(category = "foryou") {
  const sections = [];

  if (window.enjoyYourPrayerSeries && ["foryou", "prayer"].includes(category)) {
    sections.push({
      sectionTitle: "Salah & Worship",
      seriesList: [
        {
          title: window.enjoyYourPrayerSeries.title,
          speaker: window.enjoyYourPrayerSeries.speaker,
          episodes: `${window.enjoyYourPrayerSeries.episodes.length} Lectures`,
          thumbnailImage: "./assets/thumbnail/salah/enjoy-your-prayer-card.jpg",
          link: window.enjoyYourPrayerSeries.seriesPageUrl,
          description: window.enjoyYourPrayerSeries.description,
        },
      ],
    });
  }

  if (window.seerahYasirQadhiSeries && ["foryou", "seerah"].includes(category)) {
    sections.push({
      sectionTitle: "Seerah",
      seriesList: [
        {
          title: window.seerahYasirQadhiSeries.title,
          speaker: window.seerahYasirQadhiSeries.speaker,
          episodes: `${window.seerahYasirQadhiSeries.episodes.length} Lectures`,
          thumbnailImage: "./assets/thumbnail/life-of-prophet-muhammad/seerah-yasir.jpg",
          link: window.seerahYasirQadhiSeries.seriesPageUrl,
          description: window.seerahYasirQadhiSeries.description,
        },
      ],
    });
  }

  if (window.fortyHadithSeries && ["foryou", "hadith"].includes(category)) {
    sections.push({
      sectionTitle: "Hadith",
      seriesList: [
        {
          title: window.fortyHadithSeries.title,
          speaker: window.fortyHadithSeries.speaker,
          episodes: `${window.fortyHadithSeries.episodes.length} Lectures`,
          thumbnailImage:
            window.fortyHadithSeries.thumbnailSrc ||
            "./assets/thumbnail/forty-hadith-nawawi/episodes/episode-01.jpg",
          link: window.fortyHadithSeries.seriesPageUrl,
          description: window.fortyHadithSeries.description,
        },
      ],
    });
  }

  if (window.heartMattersSeries && ["foryou", "purification"].includes(category)) {
    sections.push({
      sectionTitle: "Purification of the Heart",
      seriesList: [
        {
          title: window.heartMattersSeries.title,
          speaker: window.heartMattersSeries.speaker,
          episodes: `${window.heartMattersSeries.episodes.length} Lectures`,
          thumbnailImage:
            window.heartMattersSeries.thumbnailSrc ||
            "./assets/thumbnail/heart-matters/episodes/episode-01.jpg",
          link: window.heartMattersSeries.seriesPageUrl,
          description: window.heartMattersSeries.description,
        },
      ],
    });
  }

  if (window.angelsInYourPresenceSeries && ["foryou", "angels"].includes(category)) {
    sections.push({
      sectionTitle: "Angels",
      seriesList: [
        {
          title: window.angelsInYourPresenceSeries.title,
          speaker: window.angelsInYourPresenceSeries.speaker,
          episodes: `${window.angelsInYourPresenceSeries.episodes.length} Lectures`,
          thumbnailImage:
            window.angelsInYourPresenceSeries.thumbnailSrc ||
            "./assets/thumbnail/angels-in-your-presence/episodes/episode-01.jpg",
          link: window.angelsInYourPresenceSeries.seriesPageUrl,
          description: window.angelsInYourPresenceSeries.description,
        },
      ],
    });
  }

  if (window.tenPromisedJannahSeries && ["foryou", "sahaba"].includes(category)) {
    sections.push({
      sectionTitle: "Sahaba",
      seriesList: [
        {
          title: window.tenPromisedJannahSeries.title,
          speaker: window.tenPromisedJannahSeries.speaker,
          episodes: `${window.tenPromisedJannahSeries.episodes.length} Lectures`,
          thumbnailImage:
            window.tenPromisedJannahSeries.thumbnailSrc ||
            "./assets/thumbnail/ten-promised-jannah/episodes/episode-01.jpg",
          link: window.tenPromisedJannahSeries.seriesPageUrl,
          description: window.tenPromisedJannahSeries.description,
        },
      ],
    });
  }

  return sections;
}

function mergeLocalSeries(sections, category) {
  if (!["foryou", "prayer", "hadith", "seerah", "sahaba", "purification", "angels"].includes(category)) {
    return sections;
  }

  const localSections = localSeriesSections(category);
  const localTitles = new Set(flattenSeries(localSections).map((series) => series.title));
  const merged = sections
    .map((section) => ({
      ...section,
      seriesList: section.seriesList.filter((series) => !localTitles.has(series.title)),
    }))
    .filter((section) => section.seriesList.length);
  const existingTitles = new Set(flattenSeries(merged).map((series) => series.title));

  localSections.forEach((localSection) => {
    const newSeries = localSection.seriesList.filter((series) => !existingTitles.has(series.title));
    if (!newSeries.length) {
      return;
    }

    const matchingSection = merged.find((section) => section.sectionTitle === localSection.sectionTitle);
    if (matchingSection) {
      matchingSection.seriesList.push(...newSeries);
    } else {
      merged.push({ ...localSection, seriesList: newSeries });
    }
    newSeries.forEach((series) => existingTitles.add(series.title));
  });

  return merged;
}

function setStatus(message, isVisible = true) {
  els.statusMessage.innerHTML = message;
  els.statusMessage.classList.toggle("is-visible", isVisible);
}

const skelLabelW = ["38%", "43%", "35%", "41%", "37%", "44%", "36%", "42%", "39%"];
const skelTitleW = ["78%", "65%", "83%", "70%", "76%", "68%", "80%", "63%", "74%"];
const skelMetaW  = ["56%", "48%", "63%", "52%", "59%", "46%", "61%", "50%", "55%"];

function showSkeletons(count = 6) {
  setStatus("", false);
  els.seriesGrid.innerHTML = Array.from({ length: count }, (_, i) => {
    const delay = i * 90;
    return `
      <div class="series-card" aria-hidden="true">
        <div class="skel skel-thumb" style="animation-delay:${delay}ms"></div>
        <div class="series-body">
          <div class="skel skel-label" style="width:${skelLabelW[i % 9]};animation-delay:${delay}ms"></div>
          <div class="skel skel-title" style="width:${skelTitleW[i % 9]};animation-delay:${delay + 50}ms"></div>
          <div class="skel skel-meta"  style="width:${skelMetaW[i % 9]};animation-delay:${delay + 100}ms"></div>
        </div>
      </div>`;
  }).join("");
}

function progressKey(series, episode) {
  return `lecture-progress:${series.playlistId}:${episode.id}`;
}

function episodeUrl(series, episode) {
  return `./pages/watch.html?series=${series.slug}&video=${episode.id}`;
}

function episodeThumbnailUrl(series, episode) {
  if (episode.thumbnailSrc) {
    return episode.thumbnailSrc;
  }

  if (series.episodeThumbnailPath && episode.number) {
    return `${series.episodeThumbnailPath}/episode-${String(episode.number).padStart(2, "0")}.jpg`;
  }

  return series.thumbnailSrc || "./public/icon.png";
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

function savedSeriesItem(series, url) {
  return {
    key: `series:${url}`,
    type: "series",
    title: series.title,
    subtitle: [series.speaker, series.episodes].filter(Boolean).join(" - "),
    url,
    savedAt: Date.now(),
  };
}

function isSeriesSaved(url) {
  return readSavedItems().some((item) => item.key === `series:${url}`);
}

function seriesActionIcons() {
  return {
    save:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span class="sr-only">Save series</span>',
    share:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg><span class="sr-only">Share series</span>',
    details:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg><span class="sr-only">Show details</span>',
  };
}

function updateSeriesSaveButton(button, saved) {
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute("aria-label", saved ? "Remove saved series" : "Save series");
}

function toggleSavedSeries(series, url, button) {
  const item = savedSeriesItem(series, url);
  const items = readSavedItems();
  const existing = items.findIndex((saved) => saved.key === item.key);
  const nextItems =
    existing >= 0
      ? items.filter((saved) => saved.key !== item.key)
      : [item, ...items.filter((saved) => saved.key !== item.key)].slice(0, 60);

  if (!writeSavedItems(nextItems)) {
    button.setAttribute("aria-label", "Could not save series");
    return;
  }

  const saved = existing < 0;
  updateSeriesSaveButton(button, saved);
}

async function shareSeries(series, url, button) {
  const absoluteUrl = new URL(url, document.baseURI).href;
  const shareData = {
    title: series.title,
    text: [series.title, series.speaker].filter(Boolean).join(" by "),
    url: absoluteUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(absoluteUrl);
    button.setAttribute("aria-label", "Series link copied");
    setTimeout(() => {
      button.setAttribute("aria-label", "Share series");
    }, 1800);
  } catch {
    button.setAttribute("aria-label", "Could not share series");
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const restMins = mins % 60;
    return `${hours}:${String(restMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function readStoredProgress(series, episode) {
  try {
    const progress = JSON.parse(localStorage.getItem(progressKey(series, episode))) || {};
    const currentTime = Number(progress.currentTime) || 0;
    const duration = Number(progress.duration) || 0;
    const percent = duration > 0 ? currentTime / duration : 0;

    if (currentTime < 10 || percent < 0.02 || percent > 0.97) {
      return null;
    }

    return {
      currentTime,
      duration,
      percent,
      updatedAt: Number(progress.updatedAt) || 0,
    };
  } catch (error) {
    return null;
  }
}

function renderContinueWatching() {
  const items = availableLocalSeries()
    .flatMap((series) =>
      series.episodes
        .filter((episode) => episode.videoSrc)
        .map((episode) => ({ series, episode, progress: readStoredProgress(series, episode) }))
        .filter((item) => item.progress),
    )
    .sort((a, b) => b.progress.updatedAt - a.progress.updatedAt)
    .slice(0, 6);

  if (!els.continueSection || !els.continueList) {
    return;
  }

  if (!items.length) {
    const hasHistory = (() => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          if (localStorage.key(i).startsWith("lecture-progress:")) return true;
        }
      } catch { /* ignore */ }
      return false;
    })();
    els.continueList.innerHTML = hasHistory
      ? `<div class="continue-empty">
           <p class="continue-empty-heading">All caught up</p>
           <p class="continue-empty-body">You've finished everything in progress. Start the next series when you're ready.</p>
           <a class="primary-link" href="./pages/series.html">Browse series</a>
         </div>`
      : `<div class="continue-empty">
           <p class="continue-empty-heading">No lectures started yet</p>
           <p class="continue-empty-body">Pick a series to begin — your progress saves automatically so you can pick up where you left off.</p>
           <a class="primary-link" href="./pages/series.html">Browse series</a>
         </div>`;
    return;
  }

  els.continueList.innerHTML = items
    .map(({ series, episode, progress }, i) => {
      const percent = Math.round(progress.percent * 100);
      const key = progressKey(series, episode);
      return `
        <div class="continue-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 50}ms" data-progress-key="${escapeHtml(key)}">
          <a class="continue-card-link" href="${episodeUrl(series, episode)}">
            <div class="continue-thumb">
              <img src="${episodeThumbnailUrl(series, episode)}" alt="" loading="lazy" />
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
              <small>${escapeHtml(series.title)} - Episode ${episode.number}</small>
              <strong>${escapeHtml(episode.title)}</strong>
              <em>Resume at ${formatDuration(progress.currentTime)}</em>
            </div>
          </a>
          <button class="continue-remove" type="button" aria-label="Remove from watch history">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    })
    .join("");
}

function renderSpeakers() {
  els.speakerList.innerHTML = speakers
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

function renderCategories() {
  els.categoryList.innerHTML = categories
    .map(
      (category) => `
        <button
          class="category-button ${category.value === state.activeCategory ? "is-active" : ""}"
          type="button"
          data-category="${category.value}"
        >
          ${escapeHtml(category.name)}
        </button>
      `,
    )
    .join("");
}

function seriesMatchesSearch(series) {
  if (!state.searchTerm) {
    return true;
  }

  const haystack = [series.title, series.speaker, series.topic, series.episodes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(state.searchTerm);
}

function seriesMatchesSpeaker(series) {
  if (!state.activeSpeaker) return true;
  return series.speaker === state.activeSpeaker;
}

function seriesProgressSummary(seriesTitle) {
  const localSeries = availableLocalSeries().find((s) => s.title === seriesTitle);
  if (!localSeries) return null;
  const watchable = localSeries.episodes.filter((e) => e.videoSrc);
  if (!watchable.length) return null;
  let completed = 0;
  let started = false;
  for (const ep of watchable) {
    try {
      const p = JSON.parse(localStorage.getItem(progressKey(localSeries, ep))) || {};
      if (p.completed) { completed++; started = true; }
      else if (p.currentTime > 10) { started = true; }
    } catch {}
  }
  if (!started) return null;
  return { completed, total: watchable.length };
}

function getSeriesUrl(series) {
  if (series.title === "Change of Heart") {
    return "./pages/series-change-of-heart.html";
  }

  if (series.title === "Enjoy Your Prayer") {
    return "./pages/series-enjoy-your-prayer.html";
  }

  if (series.title === "40 Hadith of Imam Nawawi") {
    return "./pages/series-forty-hadith-nawawi.html";
  }

  if (series.title === "Why Me | 2024 Ramadan Series") {
    return "./pages/series-why-me.html";
  }

  if (series.title === "Seerah of Prophet Muhammed (S)") {
    return "./pages/series-seerah-yasir-qadhi.html";
  }

  if (series.title === "10 Promised Jannah") {
    return "./pages/series-ten-promised-jannah.html";
  }

  if (series.title === "Heart Matters Ramadan Series 2023") {
    return "./pages/series-heart-matters.html";
  }

  if (series.title === "Angels in Your Presence") {
    return "./pages/series-angels-in-your-presence.html";
  }

  return series.link;
}

function renderSeries() {
  const series = getSortedSeries(
    flattenSeries(state.sections)
      .filter(isAllowedSeries)
      .filter(seriesMatchesSearch)
      .filter(seriesMatchesSpeaker)
      .map(enrichSeries)
  );
  const categoryName = categories.find((category) => category.value === state.activeCategory)?.name || "For You";

  els.activeCategoryLabel.textContent = state.activeSpeaker
    ? state.activeSpeaker
    : state.searchTerm
    ? `Search in ${categoryName}`
    : categoryName;
  els.resultCount.textContent = `${series.length} ${series.length === 1 ? "series" : "series"}`;

  if (!series.length) {
    els.seriesGrid.innerHTML = "";
    setStatus(
      state.searchTerm
        ? "No series matched that search. Try another title, speaker, or topic."
        : "No series in this category yet. Check back soon."
    );
    return;
  }

  setStatus("", false);
  els.seriesGrid.innerHTML = series
    .map((item, i) => {
      const seriesUrl = getSeriesUrl(item);
      const description =
        item.description ||
        descriptions[item.title] ||
        "Open the playlist to explore the complete lecture series on YouTube.";
      const progress = seriesProgressSummary(item.title);
      const saved = isSeriesSaved(seriesUrl);
      const icons = seriesActionIcons();
      return `
        <article class="series-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 50}ms">
          <a class="series-link" href="${seriesUrl}">
            <img src="${item.thumbnailImage}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.onerror=null;this.src='./public/social-preview.png';" />
          </a>
          <div class="series-body">
            <span class="series-topic">${escapeHtml(item.topic || "Series")}</span>
            <a class="series-title" href="${seriesUrl}">
              ${escapeHtml(item.title)}
            </a>
            <div class="series-meta">
              <span>${escapeHtml(item.speaker || "Speaker TBA")}</span>
              <span>${escapeHtml(item.episodes || "Lectures")}</span>
              ${item.viewcount ? `<span>${escapeHtml(item.viewcount)}</span>` : ""}
            </div>
            ${progress ? `<div class="series-progress-track" aria-label="${progress.completed} of ${progress.total} episodes watched"><div class="series-progress-fill" style="width:${Math.round(progress.completed / progress.total * 100)}%"></div></div>` : ""}
            <div class="card-actions">
              <button class="mini-action icon-btn save-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-pressed="${saved}" aria-label="${saved ? "Remove saved series" : "Save series"}">
                ${icons.save}
              </button>
              <button class="mini-action icon-btn share-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-label="Share series">${icons.share}</button>
              <button class="details-toggle icon-btn" type="button" aria-expanded="false" aria-label="Show details">${icons.details}</button>
            </div>
            <p class="series-description">${escapeHtml(description)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadCategory(category) {
  state.activeCategory = category;
  state.searchTerm = "";
  els.searchInput.value = "";
  renderCategories();
  showSkeletons(6);

  if (localFirstCategories.has(category)) {
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category]), category);
    renderSeries();
    return;
  }

  try {
    const response = await fetch(`${API_ROOT}/${category}-data.json?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Could not load ${category}`);
    }

    const rawText = await response.text();
    state.sections = mergeLocalSeries(normalizeSections(JSON.parse(cleanJson(rawText))), category);
  } catch (error) {
    console.warn(error);
    state.sections = mergeLocalSeries(normalizeSections(localCategoryFallbacks[category] || fallbackData), category);
    setStatus(
      `Live data could not be loaded, so a saved starter collection is shown. <button class="retry-button" type="button">Retry</button>`,
    );
  }

  renderSeries();
}

function bindEvents() {
  if (els.menuToggle) {
    els.menuToggle.addEventListener("click", () => {
      const isOpen = els.siteMenu.classList.toggle("is-open");
      document.body.classList.toggle("menu-open", isOpen);
      els.menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    els.siteMenu.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        els.siteMenu.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        els.menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  els.categoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }
    state.activeSpeaker = null;
    loadCategory(button.dataset.category);
  });

  els.seriesGrid.addEventListener("click", (event) => {
    const saveButton = event.target.closest(".save-series-button");
    if (saveButton) {
      const card = saveButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(state.sections).find((series) => series.title === title);
      if (item) toggleSavedSeries(item, saveButton.dataset.seriesUrl, saveButton);
      return;
    }

    const shareButton = event.target.closest(".share-series-button");
    if (shareButton) {
      const card = shareButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(state.sections).find((series) => series.title === title);
      if (item) shareSeries(item, shareButton.dataset.seriesUrl, shareButton);
      return;
    }

    const button = event.target.closest(".details-toggle");
    if (!button) {
      return;
    }
    const card = button.closest(".series-card");
    const isExpanded = card.classList.toggle("is-expanded");
    button.setAttribute("aria-label", isExpanded ? "Hide details" : "Show details");
    button.setAttribute("aria-expanded", String(isExpanded));
  });

  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.searchTerm = els.searchInput.value.trim().toLowerCase();
    renderSeries();
  });

  els.searchInput.addEventListener("input", () => {
    state.searchTerm = els.searchInput.value.trim().toLowerCase();
    renderSeries();
  });

  els.statusMessage.addEventListener("click", (event) => {
    if (event.target.matches(".retry-button")) {
      loadCategory(state.activeCategory);
    }
  });

  els.sortSelect.addEventListener("change", () => {
    state.sortBy = els.sortSelect.value;
    renderSeries();
  });
}

renderSpeakers();
renderCategories();
renderContinueWatching();
bindEvents();
loadCategory(state.activeCategory);

els.continueList?.addEventListener("click", (e) => {
  const btn = e.target.closest(".continue-remove");
  if (!btn) return;
  const card = btn.closest("[data-progress-key]");
  if (!card) return;
  try { localStorage.removeItem(card.dataset.progressKey); } catch {}
  renderContinueWatching();
});

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        sectionObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.06, rootMargin: "0px 0px -32px 0px" },
);

document.querySelectorAll("[data-reveal]").forEach((el) => {
  if (el.getBoundingClientRect().top > window.innerHeight) {
    el.classList.add("section-reveal");
    sectionObserver.observe(el);
  }
});
