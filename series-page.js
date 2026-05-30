function formatViews(n) {
  if (!n) return "";
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K views`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

const series = window.currentSeries;
const episodeList = document.querySelector("#episode-list");
const startLink = document.querySelector("#start-series-link");

function episodeUrl(episode) {
  return `./watch.html?series=${series.slug}&video=${episode.id}`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

startLink.href = episodeUrl(series.episodes[0]);

episodeList.innerHTML = series.episodes
  .map(
    (episode) => `
      <a class="episode-card" href="${episodeUrl(episode)}">
        <img
          src="https://i.ytimg.com/vi/${episode.id}/hqdefault.jpg"
          alt=""
          loading="lazy"
        />
        <div class="episode-info">
          <span class="episode-number">
            Episode ${episode.number}
            ${episode.recap ? '<span class="recap-badge">Recap</span>' : ""}
          </span>
          <strong>${episode.title}</strong>
          <span class="episode-date">${formatDate(episode.published)}</span>
          ${episode.views ? `<span class="episode-views">${formatViews(episode.views)}</span>` : ""}
        </div>
      </a>
    `,
  )
  .join("");
