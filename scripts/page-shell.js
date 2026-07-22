/*
 * Single source of truth for the maintained HTML page shell.
 * Generated canonical series/watch pages inherit this markup from their
 * maintained templates through generate-seo-pages.js.
 */

export const PUBLIC_PAGE_FILES = [
  "index.html",
  "pages/about.html",
  "pages/careers.html",
  "pages/category.html",
  "pages/community.html",
  "pages/copyright.html",
  "pages/donations.html",
  "pages/explore.html",
  "pages/feedback.html",
  "pages/history.html",
  "pages/partnerships.html",
  "pages/roadmap.html",
  "pages/saved.html",
  "pages/series-detail.html",
  "pages/series.html",
  "pages/settings.html",
  "pages/sign-in.html",
  "pages/speaker.html",
  "pages/speakers.html",
  "pages/watch.html",
];

export const ADMIN_PAGE_FILES = ["pages/admin.html"];

const VERSIONS = {
  styles: "20260723-maintenance",
  theme: "20260705-system-theme",
  utils: "20260723-quran-streak",
  streak: "20260723-quran-streak",
  accountSync: "20260723-modularization",
  authUi: "20260723-modularization",
  firebase: "20260723-modularization",
  navState: "20260723-desktop-shell",
};

const icon = (body, size = 16, extra = "") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

const MAIN_LINKS = [
  ["./index.html", "Home"],
  ["./pages/explore.html", "Explore"],
  ["./pages/speakers.html", "Speakers"],
  ["./pages/history.html", "History"],
  ["./pages/saved.html", "Saved"],
];

const MORE_LINKS = [
  ["./pages/settings.html", "Settings", icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>')],
  ["./pages/about.html", "About", icon('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>')],
  ["./pages/roadmap.html", "Roadmap", icon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>')],
  ["./pages/feedback.html", "Feedback", icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')],
  ["./pages/community.html", "Community", icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')],
  ["./pages/careers.html", "Contribute", icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>')],
  ["./pages/partnerships.html", "Partnerships", icon('<path d="M16 17l5-5-5-5"/><path d="M8 7l-5 5 5 5"/><path d="M14 4l-4 16"/>')],
  ["./pages/copyright.html", "Copyright", icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>')],
  ["./pages/donations.html", "Donate", icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>')],
];

const ADMIN_MORE_LINKS = [
  ["./pages/settings.html", "Settings"],
  ["./pages/roadmap.html", "Roadmap"],
  ["./pages/feedback.html", "Feedback"],
];

const BOTTOM_LINKS = [
  ["./index.html", "Home", icon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', 22)],
  ["./pages/explore.html", "Explore", icon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>', 22)],
  ["./pages/history.html", "History", icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 22)],
  ["./pages/saved.html", "Saved", icon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', 22)],
  ["./pages/speakers.html", "Speakers", icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 22)],
];

const SIDEBAR_LINKS = [
  ["./index.html", "Home", icon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', 22)],
  ["./pages/explore.html", "Explore", icon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>', 22)],
  ["./pages/speakers.html", "Speakers", icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 22)],
  null,
  ["./pages/history.html", "History", icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 22)],
  ["./pages/saved.html", "Saved", icon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', 22)],
  ["./pages/settings.html", "Settings", icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/>', 22)],
];

const region = (name, content) => `    <!-- page-shell:${name}:start -->\n${content}\n    <!-- page-shell:${name}:end -->`;

export function renderHeadAssets() {
  return region("head-assets", `    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inria+Serif:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="./styles/styles.css?v=${VERSIONS.styles}" />
    <script src="./scripts/theme.js?v=${VERSIONS.theme}"></script>`);
}

export function renderHeader({ home = false, admin = false } = {}) {
  const menuClass = [
    "site-menu",
    home ? "" : "page-menu",
    admin ? "" : "sidebar-replaced-menu",
  ].filter(Boolean).join(" ");
  const moreLinks = admin ? ADMIN_MORE_LINKS : MORE_LINKS;
  const desktopLinks = MAIN_LINKS.map(([href, label]) => `          <a href="${href}">${label}</a>`).join("\n");
  const menuLinks = moreLinks.map(([href, label, itemIcon]) => `            <a href="${href}" role="menuitem">${itemIcon ? `\n              ${itemIcon}` : ""}\n              ${label}\n            </a>`).join("\n");
  const search = admin ? "" : `
        <form class="desktop-nav-search" action="./index.html" method="get" role="search">
          <label class="sr-only" for="desktop-site-search">Search lectures</label>
          <input id="desktop-site-search" name="q" type="search" placeholder="Search lectures, speakers, or topics" autocomplete="off" />
          <button type="submit" aria-label="Search">
            ${icon('<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>', 20)}
          </button>
        </form>`;
  const sidebar = admin ? "" : `
    <aside class="desktop-sidebar" aria-label="Desktop navigation">
      <nav class="desktop-sidebar-nav" aria-label="Study navigation">
        <p class="desktop-sidebar-heading">Discover</p>
${SIDEBAR_LINKS.map((item) => item
    ? `        <a class="desktop-sidebar-link" href="${item[0]}" title="${item[1]}">
          ${item[2]}
          <span>${item[1]}</span>
        </a>`
    : `        <div class="desktop-sidebar-divider" role="separator"></div>
        <p class="desktop-sidebar-heading">Your library</p>`).join("\n")}
      </nav>
      <a class="desktop-sidebar-about" href="./pages/about.html">Focused, ad-free learning</a>
    </aside>`;
  return region("header", `    <header class="site-header">
      <nav class="nav-shell" aria-label="Primary navigation">
        <a class="brand" href="./index.html" aria-label="Improving Muslim home">
          <img src="./public/icon.png" alt="" />
          <span>Improving Muslim</span>
        </a>
${search}

        <div class="${menuClass}" id="site-menu">
${desktopLinks}
        </div>

        <div class="nav-more" id="nav-more">
          <button class="nav-more-trigger" id="nav-more-trigger" type="button" aria-label="More menu" aria-expanded="false" aria-controls="nav-more-menu" aria-haspopup="true">
            <svg class="nav-more-icon-menu" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <span class="nav-more-label">More</span>
            <svg class="nav-more-icon-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="nav-more-menu" id="nav-more-menu" role="menu" hidden>
${menuLinks}
          </div>
        </div>
      </nav>
    </header>${sidebar}`);
}

export function renderFooter({ admin = false } = {}) {
  const content = admin
    ? `    <footer class="site-footer">
      <p>Private product dashboard.</p>
      <a href="./index.html">Home</a>
      <a href="./pages/settings.html">Settings</a>
    </footer>`
    : `    <footer class="site-footer">
      <p>Built for easy discovery and quiet study.</p>
      <a href="./pages/about.html">Why this exists</a>
      <a href="./pages/community.html">Community</a>
      <a href="./pages/careers.html">Contribute</a>
      <a href="./pages/partnerships.html">Partnerships</a>
      <a href="./pages/feedback.html">Feedback</a>
      <a href="./pages/roadmap.html">Roadmap</a>
      <a href="./pages/copyright.html">Copyright</a>
      <a class="donate-link" href="./pages/donations.html">Donate</a>
    </footer>`;
  return region("footer", content);
}

export function renderBottomNav({ admin = false } = {}) {
  const content = admin ? "" : `    <nav class="bottom-nav" aria-label="Main navigation">
${BOTTOM_LINKS.map(([href, label, itemIcon]) => `      <a class="bottom-nav-item" href="${href}">
        ${itemIcon}
        <span>${label}</span>
      </a>`).join("\n")}
    </nav>`;
  return region("bottom-nav", content);
}

export function renderRuntime() {
  return region("runtime", `    <script src="./scripts/utils.js?v=${VERSIONS.utils}" defer></script>
    <script src="./scripts/streak-ui.js?v=${VERSIONS.streak}" defer></script>
    <script src="./scripts/account-sync-model.js?v=${VERSIONS.accountSync}" defer></script>
    <script src="./scripts/auth-ui.js?v=${VERSIONS.authUi}" defer></script>
    <script src="./scripts/firebase-auth.js?v=${VERSIONS.firebase}" defer></script>
    <script src="./scripts/nav-more.js" defer></script>
    <script src="./scripts/nav-state.js?v=${VERSIONS.navState}" defer></script>`);
}

const markerPattern = (name) => new RegExp(`    <!-- page-shell:${name}:start -->[\\s\\S]*?    <!-- page-shell:${name}:end -->`);

function replaceRegion(html, name, rendered, legacyPattern) {
  const marked = markerPattern(name);
  if (marked.test(html)) return html.replace(marked, rendered);
  if (!legacyPattern.test(html)) throw new Error(`Could not find legacy or generated ${name} region`);
  return html.replace(legacyPattern, rendered);
}

export function applyPageShell(input, options = {}) {
  const { home = false, admin = false } = options;
  let html = input.replace(/\r\n/g, "\n");

  html = replaceRegion(
    html,
    "head-assets",
    renderHeadAssets(),
    /    <link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>[\s\S]*?    <script src="\.\/scripts\/theme\.js[^\"]*"><\/script>/,
  );
  html = replaceRegion(html, "header", renderHeader({ home, admin }), /    <header class="site-header">[\s\S]*?<\/header>/);
  html = replaceRegion(html, "footer", renderFooter({ admin }), /    <footer class="site-footer">[\s\S]*?<\/footer>/);

  const commonScript = /\n?[ \t]*<script src="\.\/scripts\/(?:utils|streak-ui|account-sync-model|auth-ui|firebase-auth|nav-more|nav-state)\.js[^\"]*"(?: defer)?><\/script>[ \t]*/g;
  html = html.replace(commonScript, "");

  if (markerPattern("runtime").test(html)) {
    html = html.replace(markerPattern("runtime"), renderRuntime());
  } else {
    const footerEnd = "    <!-- page-shell:footer:end -->";
    html = html.replace(footerEnd, `${footerEnd}\n${renderRuntime()}`);
  }

  const bottom = renderBottomNav({ admin });
  if (markerPattern("bottom-nav").test(html)) {
    html = html.replace(markerPattern("bottom-nav"), bottom);
  } else if (/    <nav class="bottom-nav"[\s\S]*?<\/nav>/.test(html)) {
    html = html.replace(/    <nav class="bottom-nav"[\s\S]*?<\/nav>/, bottom);
  } else {
    html = html.replace(renderRuntime(), `${renderRuntime()}\n${bottom}`);
  }

  return `${html.trimEnd()}\n`;
}
