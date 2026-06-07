const API_ROOT = "https://sajidmohd717.github.io/series-api";

const categories = [
  { name: "All", value: "foryou" },
  { name: "Purification", value: "purification" },
  { name: "Prayer", value: "prayer" },
  { name: "Dhikr", value: "dhikr" },
  { name: "Hadith", value: "hadith" },
  { name: "Seerah", value: "seerah" },
  { name: "Sahaba", value: "sahaba" },
  { name: "Quran", value: "quran" },
  { name: "Tafsir", value: "tafsir" },
  { name: "Aqeedah", value: "aqeedah" },
  { name: "Prophets", value: "prophets" },
  { name: "Angels", value: "angels" },
  { name: "Arabic", value: "arabic" },
  { name: "Fiqh", value: "fiqh" },
  { name: "Hereafter", value: "hereafter" },
];

const speakers = window.speakers || [];
const {
  escapeHtml,
  formatDuration,
  formatViewCount,
  getAllSeries,
  getStandaloneLectures,
  progressKey,
  readJsonStorage,
  readSavedItems,
  PROGRESS_PREFIX,
  storageKeysWithPrefix,
  writeSavedItems,
} = window.IMUtils;
const episodeUrl = (series, episode) => window.IMUtils.episodeUrl(series, episode);
const episodeThumbnailUrl = (series, episode) => window.IMUtils.episodeThumbnailUrl(series, episode);
const standaloneLectureUrl = (lecture) => window.IMUtils.standaloneLectureUrl(lecture);
const standaloneLectureThumbnailUrl = (lecture) => window.IMUtils.standaloneLectureThumbnailUrl(lecture);
const standaloneProgressKey = (lecture) => window.IMUtils.standaloneProgressKey(lecture);

const excludedSpeakerNames = new Set([
  [117, 116, 104, 109, 97, 110, 32, 105, 98, 110, 32, 102, 97, 114, 111, 111, 113]
    .map((code) => String.fromCharCode(code))
    .join(""),
]);

const imageMap = window.IMUtils.imageMap;

const fallbackData = [
  {
    sectionTitle: "Hadith",
    seriesList: [
      {
        title: "40 Hadith of Imam Nawawi",
        speaker: "Navaid Aziz",
        episodes: "46 Lectures",
        thumbnailImage: "fortyHadithNawawi",
        link: "./pages/series-detail.html?id=forty-hadith-nawawi",
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
        link: "./pages/series-detail.html?id=enjoy-your-prayer",
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
        link: "./pages/series-detail.html?id=heart-matters",
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
        link: "./pages/series-detail.html?id=message-of-the-quran",
      },
      {
        title: "The Parables of The Quran",
        speaker: "Yasir Qadhi",
        episodes: "29 Lectures",
        thumbnailImage: "parablesQuran",
        link: "./pages/series-detail.html?id=parables-of-the-quran",
      },
      {
        title: "Wisdoms of The Quran - Ramadan Series 2024",
        speaker: "Yasir Qadhi",
        episodes: "26 Lectures",
        thumbnailImage: "wisdomsQuran",
        link: "./pages/series-detail.html?id=wisdoms-of-the-quran",
      },
    ],
  },
];

const localCategoryFallbacks = (() => {
  const map = {};
  for (const entry of (window.seriesConfig || [])) {
    if (!entry.title) continue;
    if (!map[entry.category]) map[entry.category] = [];
    let section = map[entry.category].find(sec => sec.sectionTitle === entry.sectionTitle);
    if (!section) {
      section = { sectionTitle: entry.sectionTitle, seriesList: [] };
      map[entry.category].push(section);
    }
    section.seriesList.push({
      title: entry.title,
      speaker: entry.speaker,
      episodes: `${entry.episodeCount} Lectures`,
      thumbnailImage: entry.thumbnailSrc,
      link: `./pages/series-detail.html?id=${entry.slug}`,
    });
  }
  return map;
})();

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
  "The Message of the Quran in 30 Lessons":
    "A structured overview of the Quran's message across 30 lessons, moving through the surahs and major themes of guidance, faith, worship, law, stories, and the Hereafter.",
  "The Parables of The Quran":
    "A Ramadan tafsir series exploring Quranic parables, why Allah uses them, and how these examples shape faith, sincerity, charity, knowledge, gratitude, and attachment to the Hereafter.",
  "Allah's Words to Musa Were Meant for You Too":
    "A calming standalone reminder from the story of Musa about listening to Allah's words, protecting salah, and preparing for the meeting with Him.",
};

const state = {
  activeCategory: "foryou",
  sections: [],
  searchTerm: "",
  sortBy: "random",
  activeSpeaker: null,
  contentType: "all",
};

function enrichSeries(item) {
  const local = availableLocalSeries().find(s => s.title === item.title);
  if (local) {
    const total = local.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (total > 0) return { ...item, viewcount: formatViewCount(total) };
  }
  // Fuzzy match for Seerah: API may return a slightly different title spelling
  if ((item.title.includes("Seerah of Prophet") || item.title.includes("Seerah of the Prophet")) && window.seerahYasirQadhiSeries) {
    const total = window.seerahYasirQadhiSeries.episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
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

// Stable random sort: each title gets one random key per page load, reused
// across all category switches so the order never changes mid-session.
const randomSortKeys = new Map();
function stableRandomKey(title) {
  if (!randomSortKeys.has(title)) {
    randomSortKeys.set(title, Math.random());
  }
  return randomSortKeys.get(title);
}

function getSortedSeries(list) {
  if (state.sortBy === "random") {
    return [...list].sort((a, b) => stableRandomKey(a.title) - stableRandomKey(b.title));
  }
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
  sortTrigger: document.querySelector("#sort-trigger"),
  sortDisplay: document.querySelector("#sort-display"),
  sortOptions: document.querySelector("#sort-options"),
  contentTypeFilter: document.querySelector("#content-type-filter"),
  activeCategoryLabel: document.querySelector("#active-category-label"),
};

function cleanJson(text) {
  return text.replace(/^\uFEFF/, "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

function normalizeSections(sections) {
  return sections.map((section) => ({
    ...section,
    seriesList: section.seriesList.map((series) => ({
      ...series,
      contentType: series.contentType || "series",
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
  return getAllSeries();
}

function availableStandaloneLectures() {
  return getStandaloneLectures();
}

function localStandaloneSections(category = "foryou") {
  const sections = [];
  for (const lecture of availableStandaloneLectures()) {
    if (category !== "foryou" && category !== lecture.category) continue;
    const card = {
      title: lecture.title,
      speaker: lecture.speaker,
      topic: lecture.topic || "Standalone Video",
      episodes: lecture.typeLabel || "Standalone Video",
      thumbnailImage: standaloneLectureThumbnailUrl(lecture),
      link: standaloneLectureUrl(lecture),
      description: lecture.description,
      contentType: "video",
      duration: lecture.duration,
      sourceId: lecture.id,
    };
    const sectionTitle = lecture.topic || "Standalone Videos";
    const existing = sections.find(sec => sec.sectionTitle === sectionTitle);
    if (existing) {
      existing.seriesList.push(card);
    } else {
      sections.push({ sectionTitle, seriesList: [card] });
    }
  }
  return sections;
}

function localSeriesSections(category = "foryou") {
  const sections = [];
  for (const entry of (window.seriesConfig || [])) {
    if (!entry.title) continue;
    if (category !== "foryou" && category !== entry.category) continue;
    const card = {
      title: entry.title,
      speaker: entry.speaker,
      topic: entry.sectionTitle,
      episodes: `${entry.episodeCount} Lectures`,
      thumbnailImage: entry.thumbnailSrc,
      link: `./pages/series-detail.html?id=${entry.slug}`,
      description: entry.description,
      contentType: "series",
    };
    const existing = sections.find(sec => sec.sectionTitle === entry.sectionTitle);
    if (existing) {
      existing.seriesList.push(card);
    } else {
      sections.push({ sectionTitle: entry.sectionTitle, seriesList: [card] });
    }
  }
  return sections;
}

function mergeLocalSeries(sections, category) {
  const localCategories = new Set([
    "foryou",
    ...(window.seriesConfig || []).map(e => e.category),
    ...availableStandaloneLectures().map((lecture) => lecture.category),
  ]);
  if (!localCategories.has(category)) {
    return sections;
  }

  const localSections = [...localSeriesSections(category), ...localStandaloneSections(category)];
  const localTitles = new Set(flattenSeries(localSections).map((series) => series.title.toLowerCase()));
  // Include API alias titles for series whose API/external title differs from the local data file title
  for (const entry of (window.seriesConfig || [])) {
    if (entry.apiTitle) localTitles.add(entry.apiTitle.toLowerCase());
  }
  const merged = sections
    .map((section) => ({
      ...section,
      seriesList: section.seriesList.filter((series) => !localTitles.has(series.title.toLowerCase())),
    }))
    .filter((section) => section.seriesList.length);
  const existingTitles = new Set(flattenSeries(merged).map((series) => series.title.toLowerCase()));

  localSections.forEach((localSection) => {
    const newSeries = localSection.seriesList.filter((series) => !existingTitles.has(series.title.toLowerCase()));
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

function savedSeriesItem(series, url) {
  return {
    key: `${series.contentType === "video" ? "video" : "series"}:${url}`,
    type: series.contentType === "video" ? "video" : "series",
    title: series.title,
    subtitle: [series.speaker, series.episodes].filter(Boolean).join(" - "),
    url,
    savedAt: Date.now(),
  };
}

function isSeriesSaved(url) {
  return readSavedItems().some((item) => item.key === `series:${url}` || item.key === `video:${url}`);
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
  const span = button.querySelector("span");
  if (span) span.textContent = saved ? "Saved" : "Save";
}

function closeCardMenu(menu) {
  if (!menu) return;
  menu.hidden = true;
  const trigger = menu.previousElementSibling;
  if (trigger?.classList.contains("card-menu-trigger")) {
    trigger.setAttribute("aria-expanded", "false");
  }
  menu.closest(".series-card")?.style.removeProperty("z-index");
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

function readStoredProgress(series, episode) {
  try {
    const progress = readJsonStorage(progressKey(series, episode), {});
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

function readStoredStandaloneProgress(lecture) {
  try {
    const progress = readJsonStorage(standaloneProgressKey(lecture), {});
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
        const lecture = availableStandaloneLectures().find((l) => l.id === lectureId);
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
  .slice(0, 6);

  if (!els.continueSection || !els.continueList) {
    return;
  }

  if (!items.length) {
    const hasHistory = allProgressKeys.length > 0;
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
    .map((item, i) => {
      const { progress, key } = item;
      const percent = Math.round(progress.percent * 100);
      return `
        <div class="continue-card reveal-anim" style="--reveal-delay:${Math.min(i, 8) * 50}ms" data-progress-key="${escapeHtml(key)}">
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
          <button class="continue-remove" type="button" aria-label="Remove from watch history">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    })
    .join("");
}

function renderSpeakers() {
  if (!els.speakerList) return;
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

function seriesMatchesContentType(series) {
  if (state.contentType === "all") return true;
  if (state.contentType === "videos") return series.contentType === "video";
  return series.contentType !== "video";
}

function seriesMatchesSpeaker(series) {
  if (!state.activeSpeaker) return true;
  return series.speaker === state.activeSpeaker;
}

function standaloneVideoProgress(sourceId) {
  if (!sourceId) return null;
  const stored = readJsonStorage(`${PROGRESS_PREFIX}standalone:${sourceId}`, {});
  const currentTime = Number(stored.currentTime) || 0;
  const duration = Number(stored.duration) || 0;
  if (!duration || currentTime < 10) return null;
  const pct = Math.min(1, currentTime / duration);
  if (pct > 0.97) return null; // completed — don't clutter the card
  return pct;
}

function seriesProgressSummary(seriesTitle) {
  const localSeries = availableLocalSeries().find((s) => s.title === seriesTitle);
  if (!localSeries) return null;
  const watchable = localSeries.episodes.filter((e) => e.videoSrc);
  if (!watchable.length) return null;
  let completed = 0;
  let started = false;
  for (const ep of watchable) {
    const p = readJsonStorage(progressKey(localSeries, ep), {});
    if (p.completed) { completed++; started = true; }
    else if (p.currentTime > 10) { started = true; }
  }
  if (!started) return null;
  return { completed, total: watchable.length };
}

function getSeriesUrl(series) {
  if (series.contentType === "video") return series.link;
  const local = availableLocalSeries().find(s => s.title === series.title);
  if (local) return local.seriesPageUrl;
  return series.link;
}

function renderSeries() {
  const series = getSortedSeries(
    flattenSeries(state.sections)
      .filter(isAllowedSeries)
      .filter(seriesMatchesSearch)
      .filter(seriesMatchesSpeaker)
      .filter(seriesMatchesContentType)
      .map(enrichSeries)
  );
  const categoryName = categories.find((category) => category.value === state.activeCategory)?.name || "For You";

  els.activeCategoryLabel.textContent = state.activeSpeaker
    ? state.activeSpeaker
    : state.searchTerm
    ? `Search in ${categoryName}`
    : categoryName;
  const resultLabel = state.contentType === "videos" ? "video" : state.contentType === "series" ? "series" : "item";
  els.resultCount.textContent = `${series.length} ${series.length === 1 ? resultLabel : `${resultLabel}s`}`;

  if (!series.length) {
    els.seriesGrid.innerHTML = "";
    setStatus(
      state.searchTerm
        ? "No lectures matched that search. Try another title, speaker, or topic."
        : "No lectures in this category yet. Check back soon."
    );
    return;
  }

  setStatus("", false);
  els.seriesGrid.innerHTML = series
    .map((item, i) => {
      const seriesUrl = getSeriesUrl(item);
      const isVideo = item.contentType === "video";
      const description =
        item.description ||
        descriptions[item.title] ||
        "Open the playlist to explore the complete lecture series on YouTube.";
      const seriesProgress = isVideo ? null : seriesProgressSummary(item.title);
      const videoProgress = isVideo ? standaloneVideoProgress(item.sourceId) : null;
      const saved = isSeriesSaved(seriesUrl);
      const progressBarHtml = seriesProgress
        ? `<div class="series-progress-track" aria-label="${seriesProgress.completed} of ${seriesProgress.total} episodes watched"><div class="series-progress-fill" style="width:${Math.round(seriesProgress.completed / seriesProgress.total * 100)}%"></div></div>`
        : videoProgress !== null
        ? `<div class="series-progress-track" aria-label="${Math.round(videoProgress * 100)}% watched"><div class="series-progress-fill" style="width:${Math.round(videoProgress * 100)}%"></div></div>`
        : "";
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
            ${progressBarHtml}
            <button class="card-menu-trigger" type="button" aria-label="More options" aria-expanded="false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg>
            </button>
            <div class="card-menu" hidden>
              <button class="card-menu-item save-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-pressed="${saved}" aria-label="${saved ? "Remove saved item" : `Save ${isVideo ? "video" : "series"}`}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>${saved ? "Saved" : "Save"}</span>
              </button>
              <button class="card-menu-item share-series-button" type="button" data-series-url="${escapeHtml(seriesUrl)}" aria-label="Share ${isVideo ? "video" : "series"}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <span>Share</span>
              </button>
            </div>
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

  els.contentTypeFilter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-content-type]");
    if (!button) return;
    state.contentType = button.dataset.contentType;
    els.contentTypeFilter.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderSeries();
  });

  els.seriesGrid.addEventListener("click", (event) => {
    const menuTrigger = event.target.closest(".card-menu-trigger");
    if (menuTrigger) {
      const menu = menuTrigger.nextElementSibling;
      document.querySelectorAll(".card-menu:not([hidden])").forEach((m) => {
        if (m !== menu) closeCardMenu(m);
      });
      const opening = menu.hidden;
      menu.hidden = !opening;
      menuTrigger.setAttribute("aria-expanded", String(opening));
      menuTrigger.closest(".series-card").style.zIndex = opening ? "10" : "";
      return;
    }

    const saveButton = event.target.closest(".save-series-button");
    if (saveButton) {
      const card = saveButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(state.sections).find((series) => series.title === title);
      if (item) toggleSavedSeries(item, saveButton.dataset.seriesUrl, saveButton);
      closeCardMenu(saveButton.closest(".card-menu"));
      return;
    }

    const shareButton = event.target.closest(".share-series-button");
    if (shareButton) {
      const card = shareButton.closest(".series-card");
      const title = card?.querySelector(".series-title")?.textContent.trim();
      const item = flattenSeries(state.sections).find((series) => series.title === title);
      if (item) shareSeries(item, shareButton.dataset.seriesUrl, shareButton);
      closeCardMenu(shareButton.closest(".card-menu"));
      return;
    }

  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".series-card")) {
      document.querySelectorAll(".card-menu:not([hidden])").forEach(closeCardMenu);
    }
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

  const sortLabels = { random: "Default", views: "Most viewed", az: "A–Z" };

  els.sortTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !els.sortOptions.hidden;
    els.sortOptions.hidden = isOpen;
    els.sortTrigger.setAttribute("aria-expanded", String(!isOpen));
  });

  els.sortOptions?.addEventListener("click", (e) => {
    const option = e.target.closest(".sort-option");
    if (!option) return;
    const value = option.dataset.value;
    state.sortBy = value;
    els.sortDisplay.textContent = sortLabels[value] || value;
    els.sortOptions.querySelectorAll(".sort-option").forEach((o) => {
      o.classList.toggle("is-selected", o === option);
      o.setAttribute("aria-selected", String(o === option));
    });
    els.sortOptions.hidden = true;
    els.sortTrigger.setAttribute("aria-expanded", "false");
    renderSeries();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#sort-dropdown")) {
      if (els.sortOptions) els.sortOptions.hidden = true;
      els.sortTrigger?.setAttribute("aria-expanded", "false");
    }
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
