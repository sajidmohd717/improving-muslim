const params = new URLSearchParams(window.location.search);
const speakerSlug = params.get("speaker") || "ali-hammuda";
const speakers = window.speakers || [];
const { escapeHtml, formatViewCount, getAllSeries, getStandaloneLectures, standaloneLectureThumbnailUrl, standaloneLectureUrl, seriesUrl, imageMap } = window.IMUtils;
const localSeries = getAllSeries();
const standaloneLectures = getStandaloneLectures();

// Extra hand-curated cards for series that are not in the registry.
// Series removed from the registry must be removed here too, or their
// cards will link to a redirect loop.
const curatedSeries = [];

const els = {
  title: document.querySelector("title"),
  photo: document.querySelector("#speaker-photo"),
  name: document.querySelector("#speaker-name"),
  bio: document.querySelector("#speaker-bio"),
  count: document.querySelector("#speaker-series-count"),
  grid: document.querySelector("#speaker-series-grid"),
  status: document.querySelector("#speaker-status"),
  bioToggle: document.querySelector("#speaker-bio-toggle"),
};

function setupBioToggle() {
  els.bio.classList.add("is-clamped");
  els.bioToggle.textContent = "Show more";
  const overflows = els.bio.scrollHeight > els.bio.clientHeight + 1;
  els.bioToggle.hidden = !overflows;
}

els.bioToggle.addEventListener("click", () => {
  const expanded = els.bio.classList.toggle("is-clamped") === false;
  els.bioToggle.textContent = expanded ? "Show less" : "Show more";
});

function localThumbnail(series) {
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
    link: seriesUrl(series),
    viewcount: formatViewCount(totalViews),
    description: series.description,
  };
}

function speakerSeries(speakerName) {
  const standaloneCards = standaloneLectures.map((lecture) => ({
    title: lecture.title,
    speaker: lecture.speaker,
    topic: lecture.topic || "Standalone Video",
    episodes: lecture.typeLabel || "Standalone Video",
    thumbnailImage: standaloneLectureThumbnailUrl(lecture),
    link: standaloneLectureUrl(lecture),
    description: lecture.description,
  }));
  const allSeries = [...localSeries.map(localSeriesCard), ...standaloneCards, ...curatedSeries];
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
        <img src="${series.thumbnailImage}" alt="${escapeHtml(series.title)}" loading="lazy" onerror="this.onerror=null;this.src='./public/social-preview.png';" />
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
  setupBioToggle();
  els.count.textContent = `${series.length} ${series.length === 1 ? "item" : "items"}`;

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
