const directory = document.querySelector("#speaker-directory");
const speakers = window.speakers || [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

directory.innerHTML = speakers
  .map(
    (speaker) => `
      <a class="speaker-profile-card" href="./pages/speaker.html?speaker=${encodeURIComponent(speaker.slug)}">
        <img src="${speaker.image}" alt="${escapeHtml(speaker.name)}" loading="lazy" />
        <span>
          <strong>${escapeHtml(speaker.name)}</strong>
          <em>${escapeHtml(speaker.bio)}</em>
        </span>
      </a>
    `,
  )
  .join("");
