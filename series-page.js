const series = window.changeOfHeartSeries;
const episodeList = document.querySelector("#episode-list");
const startLink = document.querySelector("#start-series-link");

function episodeUrl(episode) {
  return `./watch.html?series=change-of-heart&video=${episode.id}`;
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
        <span class="episode-number">Episode ${episode.number}</span>
        <strong>${episode.title}</strong>
        <span class="episode-date">${formatDate(episode.published)}</span>
      </a>
    `,
  )
  .join("");
