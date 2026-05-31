const API_ROOT = "https://sajidmohd717.github.io/series-api";

const categories = [
  { name: "All", value: "foryou" },
  { name: "Purification", value: "purification" },
  { name: "Prayer", value: "prayer" },
  { name: "Tafsir", value: "tafsir" },
  { name: "Hadith", value: "hadith" },
  { name: "Aqeedah", value: "aqeedah" },
  { name: "Prophets", value: "prophets" },
  { name: "Angels", value: "angels" },
  { name: "Arabic", value: "arabic" },
  { name: "Sahaba", value: "sahaba" },
  { name: "Fiqh", value: "fiqh" },
  { name: "Hereafter", value: "hereafter" },
];

const speakers = [
  { name: "Ali Hammuda", image: "./assets/speaker/ah.jpg" },
  { name: "Omar Suleiman", image: "./assets/speaker/os.jpg" },
  { name: "Yasir Qadhi", image: "./assets/speaker/yq.jpg" },
  { name: "Belal Assad", image: "./assets/speaker/ba.jpg" },
  { name: "Majed Mahmoud", image: "./assets/speaker/mm.jpg" },
  { name: "Yahya Al-Raaby", image: "./assets/speaker/yr.jpg" },
  { name: "Uthman Ibn Farooq", image: "./assets/speaker/uif.jpg" },
  { name: "Mufti Menk", image: "./assets/speaker/mufti.jpeg" },
];

const imageMap = {
  whyMe: "./assets/thumbnail/heart-softeners/whyme.jpg",
  angels1: "./assets/thumbnail/heart-softeners/angels1.jpg",
  changeofheart: "./assets/thumbnail/heart-softeners/changeofheart.png",
  heartmatters: "./assets/thumbnail/heart-softeners/heartmatters.jpg",
  messageQuran: "./assets/thumbnail/general-quran-tafsir/message-quran.jpg",
  parablesQuran: "./assets/thumbnail/general-quran-tafsir/parables-quran.jpg",
  wisdomsQuran: "./assets/thumbnail/general-quran-tafsir/wisdoms-quran.jpg",
  seerahYasirQadhi: "./assets/thumbnail/life-of-prophet-muhammad/seerah-yasir.jpg",
  seerahUthman: "./assets/thumbnail/life-of-prophet-muhammad/seerah-uthman.jpg",
  seerahMufti: "./assets/thumbnail/life-of-prophet-muhammad/seerah-mufti.jpg",
  fortress: "./assets/thumbnail/hadith/fortress.jpg",
  fatihahTafsirYQ: "./assets/thumbnail/tafsir/fatihah-yq.jpg",
  baqarahTafsirMustafa: "./assets/thumbnail/tafsir/baqarah-mustafa.jpg",
  enjoyYourPrayer: "./assets/thumbnail/salah/enjoy-your-prayer.png",
};

const fallbackData = [
  {
    sectionTitle: "Salah & Worship",
    seriesList: [
      {
        title: "Enjoy Your Prayer",
        speaker: "Ali Hammuda",
        episodes: "21 Lectures",
        thumbnailImage: "enjoyYourPrayer",
        link: "./series-enjoy-your-prayer.html",
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
        episodes: "27 Lectures",
        thumbnailImage: "heartmatters",
        link: "https://www.youtube.com/playlist?list=PLYZxc42QNctWeXvciIWtItbjhod9PjcCN",
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
      {
        title: "Angels in Your Presence",
        speaker: "Omar Suleiman",
        episodes: "32 Lectures",
        thumbnailImage: "angels1",
        link: "https://www.youtube.com/playlist?list=PLQ02IYL5pmhF2LFN-3QxnuregEv1oKPIc",
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
  prayer: [fallbackData[0]],
  purification: [fallbackData[1]],
};

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
};

const state = {
  activeCategory: "foryou",
  sections: [],
  searchTerm: "",
  sortBy: "views",
  activeSpeaker: null,
};

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
  categoryList: document.querySelector("#category-list"),
  seriesGrid: document.querySelector("#series-grid"),
  statusMessage: document.querySelector("#status-message"),
  resultCount: document.querySelector("#result-count"),
  seriesCount: document.querySelector("#series-count"),
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

function localSeriesSections() {
  const sections = [];

  if (window.enjoyYourPrayerSeries) {
    sections.push({
      sectionTitle: "Salah & Worship",
      seriesList: [
        {
          title: window.enjoyYourPrayerSeries.title,
          speaker: window.enjoyYourPrayerSeries.speaker,
          episodes: `${window.enjoyYourPrayerSeries.episodes.length} Lectures`,
          thumbnailImage: "./assets/thumbnail/salah/enjoy-your-prayer.png",
          link: window.enjoyYourPrayerSeries.seriesPageUrl,
          description: window.enjoyYourPrayerSeries.description,
        },
      ],
    });
  }

  return sections;
}

function mergeLocalSeries(sections, category) {
  if (!["foryou", "prayer"].includes(category)) {
    return sections;
  }

  const existingTitles = new Set(flattenSeries(sections).map((series) => series.title));
  const merged = [...sections];

  localSeriesSections().forEach((localSection) => {
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

function renderSpeakers() {
  els.speakerList.innerHTML = speakers
    .map(
      (speaker) => `
        <article class="speaker-card ${speaker.name === state.activeSpeaker ? "is-active" : ""}"
          role="button" tabindex="0" data-speaker="${escapeHtml(speaker.name)}">
          <img src="${speaker.image}" alt="${escapeHtml(speaker.name)}" loading="lazy" />
          <span>${escapeHtml(speaker.name)}</span>
        </article>
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

function getSeriesUrl(series) {
  if (series.title === "Change of Heart") {
    return "./series-change-of-heart.html";
  }

  if (series.title === "Enjoy Your Prayer") {
    return "./series-enjoy-your-prayer.html";
  }

  if (series.title === "Why Me | 2024 Ramadan Series") {
    return "./series-why-me.html";
  }

  return series.link;
}

function renderSeries() {
  const series = getSortedSeries(
    flattenSeries(state.sections).filter(seriesMatchesSearch).filter(seriesMatchesSpeaker).map(enrichSeries)
  );
  const categoryName = categories.find((category) => category.value === state.activeCategory)?.name || "For You";

  els.activeCategoryLabel.textContent = state.activeSpeaker
    ? state.activeSpeaker
    : state.searchTerm
    ? `Search in ${categoryName}`
    : categoryName;
  els.resultCount.textContent = `${series.length} ${series.length === 1 ? "series" : "series"}`;
  els.seriesCount.textContent = flattenSeries(state.sections).length;

  if (!series.length) {
    els.seriesGrid.innerHTML = "";
    setStatus("No series matched that search. Try another title, speaker, or topic.");
    return;
  }

  setStatus("", false);
  els.seriesGrid.innerHTML = series
    .map((item) => {
      const seriesUrl = getSeriesUrl(item);
      const description =
        item.description ||
        descriptions[item.title] ||
        "Open the playlist to explore the complete lecture series on YouTube.";
      return `
        <article class="series-card">
          <a class="series-link" href="${seriesUrl}">
            <img src="${item.thumbnailImage}" alt="${escapeHtml(item.title)}" loading="lazy" />
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
            <button class="details-toggle" type="button" aria-expanded="false">Details</button>
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
  setStatus("Loading series...");
  els.seriesGrid.innerHTML = "";

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

  renderSpeakers();
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

  els.speakerList.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-speaker]");
    if (!card) return;
    const name = card.dataset.speaker;
    state.activeSpeaker = state.activeSpeaker === name ? null : name;
    renderSpeakers();
    if (state.activeSpeaker && state.activeCategory !== "foryou") {
      await loadCategory("foryou");
    } else {
      renderSeries();
    }
    document.querySelector("#series").scrollIntoView({ behavior: "smooth" });
  });

  els.speakerList.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const card = event.target.closest("[data-speaker]");
      if (card) {
        event.preventDefault();
        card.click();
      }
    }
  });

  els.seriesGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".details-toggle");
    if (!button) {
      return;
    }
    const card = button.closest(".series-card");
    const isExpanded = card.classList.toggle("is-expanded");
    button.textContent = isExpanded ? "Hide details" : "Details";
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
bindEvents();
loadCategory(state.activeCategory);
