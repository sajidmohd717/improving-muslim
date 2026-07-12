const topics = (window.IMCategoryTaxonomy?.topics || []).filter((topic) => topic.public);

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
  const cats = (e) => Array.isArray(e.categories) ? e.categories : [e.category].filter(Boolean);
  const seriesCount = (window.seriesConfig || []).filter((series) => cats(series).includes(value)).length;
  const videoCount = (window.standaloneLectures || []).filter((lecture) => cats(lecture).includes(value)).length;
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
        <a class="explore-card${disabledClass}" data-category="${escapeHtml(topic.value)}" href="${href}" aria-label="${escapeHtml(actionLabel)}: ${escapeHtml(topic.name)}">
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
