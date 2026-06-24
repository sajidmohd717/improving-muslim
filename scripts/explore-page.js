const topics = [
  {
    name: "Purification",
    value: "purification",
    description: "Heart work, hardship, patience, and returning to Allah.",
  },
  {
    name: "Prayer",
    value: "prayer",
    description: "Build focus, love, and consistency in salah.",
  },
  {
    name: "Dhikr",
    value: "dhikr",
    description: "Daily remembrance, duas, and worship routines.",
  },
  {
    name: "Hadith",
    value: "hadith",
    description: "Foundational narrations, character, and prophetic guidance.",
  },
  {
    name: "Seerah",
    value: "seerah",
    description: "Walk through the life and mission of the Prophet.",
  },
  {
    name: "Sahaba",
    value: "sahaba",
    description: "Stories and virtues of the companions.",
  },
  {
    name: "Quran",
    value: "quran",
    description: "Reflection, tafsir, and lessons from revelation.",
  },
  {
    name: "Angels",
    value: "angels",
    description: "Learn about the unseen and worship around us.",
  },
  {
    name: "Arabic",
    value: "arabic",
    description: "Build language foundations for Quran understanding.",
  },
  {
    name: "Tafsir",
    value: "tafsir",
    description: "Deeper meanings and commentary on the Quran.",
  },
  {
    name: "Aqeedah",
    value: "aqeedah",
    description: "Core beliefs and clarity about faith.",
  },
  {
    name: "Hereafter",
    value: "hereafter",
    description: "Death, accountability, Jannah, and preparing well.",
  },
];

const paths = [
  {
    title: "I want to feel closer to Allah",
    description: "Start with prayer, dhikr, and purification of the heart.",
    href: "./index.html?category=prayer#series",
  },
  {
    title: "I want to understand the Quran",
    description: "Begin with Quran-focused series and reflection lectures.",
    href: "./index.html?category=quran#series",
  },
  {
    title: "I want to learn the Prophet's story",
    description: "Go into seerah and build context around revelation.",
    href: "./index.html?category=seerah#series",
  },
  {
    title: "I want practical daily worship",
    description: "Browse dua, dhikr, salah, and worship habits.",
    href: "./index.html?category=dhikr#series",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countsForTopic(value) {
  const seriesCount = (window.seriesConfig || []).filter((series) => series.category === value).length;
  const videoCount = (window.standaloneLectures || []).filter((lecture) => lecture.category === value).length;
  return { seriesCount, videoCount, total: seriesCount + videoCount };
}

function countLabel({ seriesCount, videoCount, total }) {
  if (!total) return "Coming soon";
  const parts = [];
  if (seriesCount) parts.push(`${seriesCount} ${seriesCount === 1 ? "series" : "series"}`);
  if (videoCount) parts.push(`${videoCount} ${videoCount === 1 ? "video" : "videos"}`);
  return parts.join(" · ");
}

function renderTopics() {
  const grid = document.querySelector("#explore-topic-grid");
  if (!grid) return;

  grid.innerHTML = topics
    .map((topic) => {
      const counts = countsForTopic(topic.value);
      const disabledClass = counts.total ? "" : " is-coming-soon";
      const href = counts.total ? `./index.html?category=${topic.value}#series` : "./pages/feedback.html";
      const actionLabel = counts.total ? "Browse topic" : "Request this topic";

      return `
        <a class="explore-card${disabledClass}" href="${href}" aria-label="${escapeHtml(actionLabel)}: ${escapeHtml(topic.name)}">
          <span class="explore-card-kicker">${escapeHtml(countLabel(counts))}</span>
          <span class="explore-card-title">${escapeHtml(topic.name)}</span>
          <span class="explore-card-copy">${escapeHtml(topic.description)}</span>
          <span class="explore-card-action">${escapeHtml(actionLabel)}</span>
        </a>
      `;
    })
    .join("");
}

function renderPaths() {
  const grid = document.querySelector("#explore-path-grid");
  if (!grid) return;

  grid.innerHTML = paths
    .map((path) => `
      <a class="explore-path-card" href="${path.href}">
        <span class="explore-card-title">${escapeHtml(path.title)}</span>
        <span class="explore-card-copy">${escapeHtml(path.description)}</span>
      </a>
    `)
    .join("");
}

renderTopics();
renderPaths();
