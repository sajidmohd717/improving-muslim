const params = new URLSearchParams(window.location.search);
const speakerSlug = params.get("speaker") || "ali-hammuda";
const speakers = window.speakers || [];
const localSeries = [
  window.changeOfHeartSeries,
  window.enjoyYourPrayerSeries,
  window.fortyHadithSeries,
  window.whyMeSeries,
].filter(Boolean);

const imageMap = {
  changeofheart: "./assets/thumbnail/heart-softeners/changeofheart.png",
  enjoyYourPrayer: "./assets/thumbnail/salah/enjoy-your-prayer.png",
  fortyHadithNawawi: "./assets/thumbnail/forty-hadith-nawawi/episodes/episode-01.jpg",
  whyMe: "./assets/thumbnail/heart-softeners/whyme.jpg",
  angels1: "./assets/thumbnail/heart-softeners/angels1.jpg",
  heartmatters: "./assets/thumbnail/heart-softeners/heartmatters.jpg",
  messageQuran: "./assets/thumbnail/general-quran-tafsir/message-quran.jpg",
  parablesQuran: "./assets/thumbnail/general-quran-tafsir/parables-quran.jpg",
  wisdomsQuran: "./assets/thumbnail/general-quran-tafsir/wisdoms-quran.jpg",
};

const curatedSeries = [
  {
    title: "Heart Matters Ramadan Series 2023",
    speaker: "Yasir Qadhi",
    topic: "Purification of the Heart",
    episodes: "27 Lectures",
    thumbnailImage: imageMap.heartmatters,
    link: "https://www.youtube.com/playlist?list=PLYZxc42QNctWeXvciIWtItbjhod9PjcCN",
    description:
      "Short daily reminders exploring spiritual diseases, emotional repair, and practical ways to soften the heart.",
  },
  {
    title: "Angels in Your Presence",
    speaker: "Omar Suleiman",
    topic: "Reflection and Contemplation",
    episodes: "32 Lectures",
    thumbnailImage: imageMap.angels1,
    link: "https://www.youtube.com/playlist?list=PLQ02IYL5pmhF2LFN-3QxnuregEv1oKPIc",
    description:
      "A study of angels and how belief in the unseen can reshape worship, character, and daily awareness.",
  },
  {
    title: "The Message of the Quran in 30 Lessons",
    speaker: "Yasir Qadhi",
    topic: "General Quran Tafsir",
    episodes: "30 Lectures",
    thumbnailImage: imageMap.messageQuran,
    link: "https://www.youtube.com/playlist?list=PLYZxc42QNctUnn09Of4rBuakQhu-Q2qpc",
    description:
      "A structured overview of core Quranic themes and lessons for reflection.",
  },
  {
    title: "The Parables of The Quran",
    speaker: "Yasir Qadhi",
    topic: "General Quran Tafsir",
    episodes: "29 Lectures",
    thumbnailImage: imageMap.parablesQuran,
    link: "https://www.youtube.com/playlist?list=PLYZxc42QNctUIsBRE5XCY6eICwl_W8jnj",
    description:
      "A tafsir series exploring the parables of the Quran and the guidance they contain.",
  },
  {
    title: "Wisdoms of The Quran - Ramadan Series 2024",
    speaker: "Yasir Qadhi",
    topic: "General Quran Tafsir",
    episodes: "26 Lectures",
    thumbnailImage: imageMap.wisdomsQuran,
    link: "https://www.youtube.com/playlist?list=PLYZxc42QNctV2v3RRYwTHdgDHp_h80mJT",
    description:
      "A Ramadan series focused on selected Quranic wisdoms and their practical meaning.",
  },
];

const els = {
  title: document.querySelector("title"),
  photo: document.querySelector("#speaker-photo"),
  name: document.querySelector("#speaker-name"),
  bio: document.querySelector("#speaker-bio"),
  count: document.querySelector("#speaker-series-count"),
  grid: document.querySelector("#speaker-series-grid"),
  status: document.querySelector("#speaker-status"),
};

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

function localThumbnail(series) {
  if (series.slug === "change-of-heart") return imageMap.changeofheart;
  if (series.slug === "enjoy-your-prayer") return imageMap.enjoyYourPrayer;
  if (series.slug === "forty-hadith-nawawi") return imageMap.fortyHadithNawawi;
  if (series.slug === "why-me") return imageMap.whyMe;
  return series.thumbnailSrc || "./public/icon.png";
}

function localSeriesCard(series) {
  const totalViews = series.episodes.reduce((sum, episode) => sum + (episode.views || 0), 0);
  return {
    title: series.title,
    speaker: series.speaker,
    topic: series.topic || "Series",
    episodes: `${series.episodes.length} Lectures`,
    thumbnailImage: localThumbnail(series),
    link: series.seriesPageUrl,
    viewcount: formatViewCount(totalViews),
    description: series.description,
  };
}

function speakerSeries(speakerName) {
  const allSeries = [...localSeries.map(localSeriesCard), ...curatedSeries];
  const seen = new Set();
  return allSeries.filter((series) => {
    if (series.speaker !== speakerName || seen.has(series.title)) return false;
    seen.add(series.title);
    return true;
  });
}

const detailIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg><span class="sr-only">Show details</span>';

function renderSeriesCard(series) {
  return `
    <article class="series-card">
      <a class="series-link" href="${series.link}">
        <img src="${series.thumbnailImage}" alt="${escapeHtml(series.title)}" loading="lazy" />
      </a>
      <div class="series-body">
        <span class="series-topic">${escapeHtml(series.topic || "Series")}</span>
        <a class="series-title" href="${series.link}">
          ${escapeHtml(series.title)}
        </a>
        <div class="series-meta">
          <span>${escapeHtml(series.speaker)}</span>
          <span>${escapeHtml(series.episodes || "Lectures")}</span>
          ${series.viewcount ? `<span>${escapeHtml(series.viewcount)}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="details-toggle icon-btn" type="button" aria-expanded="false" aria-label="Show details">${detailIcon}</button>
        </div>
        <p class="series-description">${escapeHtml(series.description || "Open this series to explore the available lectures.")}</p>
      </div>
    </article>
  `;
}

function renderSpeakerPage() {
  const speaker = speakers.find((item) => item.slug === speakerSlug) || speakers[0];
  if (!speaker) {
    els.status.textContent = "Speaker profile could not be loaded.";
    els.status.classList.add("is-visible");
    return;
  }

  const series = speakerSeries(speaker.name);
  els.title.textContent = `${speaker.name} | Improving Muslim`;
  els.photo.src = speaker.image;
  els.photo.alt = speaker.name;
  els.name.textContent = speaker.name;
  els.bio.textContent = speaker.bio;
  els.count.textContent = `${series.length} ${series.length === 1 ? "series" : "series"}`;

  if (!series.length) {
    els.grid.innerHTML = "";
    els.status.textContent = "Series will be added here as the library grows.";
    els.status.classList.add("is-visible");
    return;
  }

  els.status.classList.remove("is-visible");
  els.grid.innerHTML = series.map(renderSeriesCard).join("");
}

els.grid.addEventListener("click", (event) => {
  const button = event.target.closest(".details-toggle");
  if (!button) return;
  const card = button.closest(".series-card");
  const isExpanded = card.classList.toggle("is-expanded");
  button.setAttribute("aria-label", isExpanded ? "Hide details" : "Show details");
  button.setAttribute("aria-expanded", String(isExpanded));
});

renderSpeakerPage();
