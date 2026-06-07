# Developer Notes

This project is intentionally a plain HTML, CSS, and JavaScript site. Do not reintroduce React, Vite, or a build step unless the project direction explicitly changes.

This document is a living guide. The architecture, hosting choices, and workflow are expected to evolve as the platform grows. Treat these notes as current project context, not a rigid rulebook. Update this file whenever the actual workflow changes.

## Project Shape

- `index.html` stays at the repository root because GitHub Pages serves it as the entry point.
- `pages/` contains secondary HTML pages such as series pages, speaker profiles, settings, about, and watch.
- `scripts/` contains browser logic and utility scripts.
- `data/` contains series and speaker data files.
- `styles/styles.css` is the CSS entry point — it `@import`s 19 focused files from `styles/`. Do not add rules directly to `styles.css`; add them to the appropriate sub-file.
- `scripts/script.js` renders homepage speakers, categories, and series cards.
- `pages/speakers.html` is the full speaker directory linked from the homepage speaker strip.
- `scripts/series-page.js` renders dedicated series episode lists.
- `pages/watch.html` is the focused video player page.
- `scripts/watch-page.js` loads the selected episode, handles native playback, progress saving, completion state, and media-session controls.
- `data/series-registry.js` is the central series registry — the single source of truth for all series slugs, categories, and global keys.
- `data/*-data.js` files are the series data sources.
- `data/speaker-data.js` controls speaker ordering and profile metadata.
- `assets/captions/` contains WebVTT captions, grouped by series slug.
- `scripts/transcript-to-vtt.js` converts pasted YouTube-style transcripts into WebVTT cues.
- `scripts/check-a11y.js` scans every static HTML page for common accessibility issues.
- `scripts/error-handler.js` is loaded before all other scripts. It catches unhandled JS errors and promise rejections, shows a friendly fallback UI, and silently reports crashes to `contact@improvingmuslim.com` via FormSubmit.
- `scripts/nav-state.js` tracks the last visited series URL for the "Series" nav link, and injects the mobile back button on all inner pages.
- `assets/thumbnail/` and `assets/speaker/` contain local image assets.
- `public/` contains brand-facing assets: logo/favicons, the web manifest, and the default social sharing preview image.
- `.github/workflows/check.yml` is the CI workflow that runs syntax and accessibility checks automatically on every push and pull request to `main`.
- `CNAME` pins the GitHub Pages custom domain to `improvingmuslim.com`.

All pages in `pages/` include a `<base href="../" />` tag. Keep all project links in the form `./pages/...`, `./scripts/...`, `./data/...`, `./assets/...`, and `./styles/...` so links resolve correctly from both `index.html` and inner pages.

## Current Content State

The platform currently has 12 series registered across 8 categories:

| Series | Speaker | Category | Status |
|---|---|---|---|
| Enjoy Your Prayer | Ali Hammuda | Prayer | Partially unlocked |
| Fortress of the Muslim | Assim Al-Hakeem | Dhikr | Partially unlocked |
| Seerah of the Prophet (S) | Yasir Qadhi | Seerah | Partially unlocked |
| 40 Hadith of Imam Nawawi | Navaid Aziz | Hadith | Partially unlocked |
| Heart Matters Ramadan 2023 | Yasir Qadhi | Purification | Partially unlocked |
| Change of Heart | Ali Hammuda | Purification | Partially unlocked |
| Why Me? | Omar Suleiman | Purification | Catalogue only |
| Angels in Your Presence | Omar Suleiman | Angels | Partially unlocked |
| Message of the Quran in 30 Lessons | Yasir Qadhi | Quran | Partially unlocked |
| Parables of the Quran | Yasir Qadhi | Quran | Partially unlocked |
| 10 Promised Jannah | AbdulRahman Hassan | Sahaba | Partially unlocked |
| Madina Arabic Books | Asif Meherali | Arabic | Partially unlocked |

Episodes without an uploaded R2 MP4 should not have a `videoSrc`. The UI automatically shows them as `Uploading soon`. Do not add placeholder local paths.

```js
statusNote: "Video not added yet. It will be uploaded in the future, insha'Allah."
```

The homepage topic order should stay intentional and learning-led. Series should appear in the topic that best matches the learner's intent, not merely the speaker or source playlist.

## CI / Automated Checks

Every push and pull request to `main` triggers `.github/workflows/check.yml`, which runs on a clean Ubuntu environment:

1. `npm run check:js` — Node.js syntax check on all 28+ JS and data files.
2. `npm run check:a11y` — Custom accessibility audit of all HTML pages.

If either step fails, GitHub marks the push red and sends a notification. Check the Actions tab at `github.com/sajidmohd717/islamic-lectures-react/actions` after each push to confirm green.

The same checks can be run locally before pushing:

```bash
npm run check
```

Do not skip the checks before pushing. A red CI run means something is broken in production.

## Error Handler and Monitoring

`scripts/error-handler.js` must be the first script loaded on every page, before all other scripts including `utils.js`. It:

- Registers `window.onerror` and `window.addEventListener('unhandledrejection', ...)` before anything else can crash.
- Shows a friendly fallback UI inside `<main>` if a script error occurs, rather than leaving the user with a blank or broken page.
- Silently POSTs error details (message, page URL, browser) to `contact@improvingmuslim.com` via FormSubmit — fire and forget, never surfaced to the user.
- Filters out non-crash rejections: `AbortError` (fetch cancelled on navigation), network `TypeError`s (Safari "Load failed", Chrome "Failed to fetch"), and any rejection that fires while `document.hidden` is true (bfcache artifacts).
- Resets its state on `pageshow` with `persisted: true` so Safari's back-forward cache restoration never incorrectly triggers the fallback UI.

**FormSubmit note:** The first email from a new endpoint requires a one-time confirmation click from `contact@improvingmuslim.com`. If error reports stop arriving, check the inbox for a re-confirmation request.

The error report email arrives with subject `Site error: /pages/watch.html` (or whichever page it occurred on), and includes the error message, full page URL, and browser user-agent.

## Hosting

The static website is deployed with GitHub Pages from the `main` branch root.

- GitHub Pages URL: `https://sajidmohd717.github.io/islamic-lectures-react/`
- Custom domain: `https://improvingmuslim.com`

Videos are not stored in Git. Large MP4 files are hosted on Cloudflare R2 and referenced by URL in the episode data.

## Video Hosting Pattern

R2 bucket: `islamic-lectures-videos`

Public R2 base URL:

```
https://pub-276a3999c8d2451dad841d712cdb5ca0.r2.dev
```

Object naming pattern — series episodes:

```
change-of-heart/change-of-heart-ep-1.mp4
change-of-heart/change-of-heart-ep-2.mp4
```

Object naming pattern — standalone lectures:

```
{speaker-slug}/stand-alone/{lecture-slug}.mp4

belal-assaad/stand-alone/qadr-sabr.mp4
abu-bakr-zoud/stand-alone/allahs-words-to-musa-were-meant-for-you-too.mp4
```

Episode data should point to R2 URLs. The bucket name does **not** appear in the public URL — only the object key path:

```js
// Series episode
videoSrc: "https://pub-276a3999c8d2451dad841d712cdb5ca0.r2.dev/change-of-heart/change-of-heart-ep-1.mp4"

// Standalone lecture
videoSrc: "https://pub-276a3999c8d2451dad841d712cdb5ca0.r2.dev/belal-assaad/stand-alone/qadr-sabr.mp4"
```

New series should follow the folder/object pattern:

```
series-slug/series-slug-ep-1.mp4
series-slug/series-slug-ep-2.mp4
```

Do not commit real video files to the repository. The `assets/videos/` folders only contain `.gitkeep` files to preserve the intended local structure.

## Uploading Large Videos To R2

Cloudflare's dashboard uploader has a 300 MB limit. Use the S3-compatible API for larger files.

Configure AWS CLI with an R2 profile:

```powershell
aws configure --profile r2
# Default region name: auto
# Default output format: json
```

Upload or overwrite a series episode:

```powershell
aws s3 cp "C:\Users\sajid\Downloads\change-of-heart-ep-1.mp4" `
  "s3://islamic-lectures-videos/change-of-heart/change-of-heart-ep-1.mp4" `
  --endpoint-url "https://995f2e2da1ff1e87964b10dfba768477.r2.cloudflarestorage.com" `
  --content-type "video/mp4" --profile r2
```

Upload or overwrite a standalone lecture:

```powershell
aws s3 cp "C:\Users\sajid\Downloads\qadr-sabr.mp4" `
  "s3://islamic-lectures-videos/belal-assaad/stand-alone/qadr-sabr.mp4" `
  --endpoint-url "https://995f2e2da1ff1e87964b10dfba768477.r2.cloudflarestorage.com" `
  --content-type "video/mp4" --profile r2
```

### Troubleshooting upload errors

**`AccessDenied` on `CreateMultipartUpload`** — this usually means the bucket name in the command is wrong (the API token is scoped to specific buckets and silently denies access to unknown ones). The correct bucket name is `islamic-lectures-videos` (with an **s**). Confirm by listing the bucket:

```powershell
aws s3 ls s3://islamic-lectures-videos/ `
  --endpoint-url "https://995f2e2da1ff1e87964b10dfba768477.r2.cloudflarestorage.com" `
  --profile r2
```

If that returns a folder listing the bucket name is correct and the token has read access. If it still returns `AccessDenied`, the API token may need to be updated in the Cloudflare dashboard (R2 → Manage API Tokens) to include Object Read & Write permission for `islamic-lectures-videos`.

Note: `aws s3 ls` (list all buckets) will return `AccessDenied` — this is expected. The token is intentionally scoped to specific buckets, not global list access.

Never commit or paste production R2 secrets into the repository or docs.

## Episode Publishing Workflow

When adding a new watchable episode:

1. Upload the MP4 to Cloudflare R2 using the naming pattern above.
2. Confirm the public R2 URL responds successfully.
3. Update the matching episode object in the relevant `data/*-data.js` file with `videoSrc`.
4. If a transcript is available, generate a VTT file under `assets/captions/{series-slug}/`.
5. Add `captionsSrc` to the episode object.
6. For Islamic lecture series: add `takeaways` and `recap` when the transcript has been reviewed.
7. For language course series (e.g. Madina Arabic): add `grammarNotes` and `recap` — skip `takeaways`. See the Language Course Episodes section below.
8. Keep `episode.id` unchanged — progress is keyed to the YouTube video ID, not the R2 URL.
9. Make sure the local episode thumbnail exists as `assets/thumbnail/{series-slug}/episodes/episode-XX.jpg`.
10. Run `npm run check` and test locally.

When an episode is not uploaded yet: omit `videoSrc`, keep `statusNote`. The series page and watch sidebar show it as `Uploading soon`.

## Adding A New Series

All series registration flows through `data/series-registry.js`. Adding a new series no longer requires editing `scripts/script.js`, `scripts/watch-page.js`, `scripts/history-page.js`, or `scripts/speaker-page.js` — those all derive their series lists from the registry automatically.

### Step 1 — Create the data file

Add `data/{series-slug}-data.js`. Required fields:

```js
window.myNewSeries = {
  title: "Series Title",
  slug: "series-slug",
  seriesPageUrl: "./pages/series-series-slug.html",
  speaker: "Speaker Name",
  topic: "Category Display Name",
  thumbnailSrc: "./assets/thumbnail/series-slug/series-card.jpg",
  episodeThumbnailPath: "./assets/thumbnail/series-slug/episodes",
  playlistId: "YOUTUBE_PLAYLIST_ID",
  description: "Short description used on series cards.",
  episodes: [
    {
      number: 1,
      id: "YOUTUBE_VIDEO_ID",
      title: "Episode title",
      published: "YYYY-MM-DD",
      views: 0,
      videoSrc: "https://pub-276a3999c8d2451dad841d712cdb5ca0.r2.dev/series-slug/series-slug-ep-1.mp4",
      captionsSrc: "./assets/captions/series-slug/episode-01.vtt",
    },
  ],
};
```

Only add `videoSrc` for episodes that have actually been uploaded to R2.

### Step 2 — Register in the series registry

Add one entry to `data/series-registry.js`:

```js
{ globalKey: "myNewSeries", slug: "series-slug", category: "purification", sectionTitle: "Purification of the Heart" },
```

`category` must match one of the values in the `categories` array in `scripts/script.js`. `sectionTitle` is the heading that groups series on the homepage — multiple series can share the same `sectionTitle`.

### Step 3 — Create the series page

Copy an existing `pages/series-*.html` as a starting point. Three things change per series:

1. The `<head>` meta tags (title, description, og:title, og:description, og:image, og:url, twitter:*)
2. The `<p class="hero-copy">` — write crafted prose describing the series
3. The three bottom script lines:

```html
<script src="./data/series-slug-data.js"></script>
<script>window.currentSeries = window.myNewSeries;</script>
<script src="./scripts/series-page.js" defer></script>
```

The hero eyebrow, h1, thumbnail, episode count, and start link are all populated automatically by `renderHero()` in `scripts/series-page.js`.

### Step 4 — Add the data file script tag to shared pages

`pages/watch.html` uses a dynamic loader — add the slug-to-file mapping in the inline `<script>` block near the bottom of `<head>`:

```js
'series-slug': './data/series-slug-data.js?v=YYYYMMDD-slug'
```

Also add a `<script>` tag to each of these three pages alongside the existing data file tags:

- `index.html`
- `pages/history.html`
- `pages/speaker.html`

```html
<script src="./data/series-slug-data.js"></script>
```

### Step 5 — Add assets and speaker

- Series thumbnail: `assets/thumbnail/{series-slug}/series-card.jpg`
- Episode thumbnails: `assets/thumbnail/{series-slug}/episodes/episode-01.jpg`, `episode-02.jpg`, ...
- If the speaker is new: add their entry to `data/speaker-data.js` and a photo to `assets/speaker/`
- Add the series page URL to `sitemap.xml`
- Add a card to `pages/series.html` (the static browse page)

### Step 6 — Update the JS syntax check

Add the new data file to the `check:js` script in `package.json`:

```
&& node --check data/series-slug-data.js
```

### Step 7 — Verify

Run `npm run check` and test: homepage (series appears in correct category), series page (hero and episodes render), watch page (episode plays), speaker page (series listed under correct speaker), history page (watch progress tracked).

## Language Course Episodes

Language course series (currently: Madina Arabic Books) use a different episode note structure from Islamic lecture series.

**Omit `takeaways`** — action-point takeaways do not apply to grammar lessons.

**Use `grammarNotes`** — an array of compact reference cards, each with three fields:

```js
grammarNotes: [
  {
    term: "Mubtada",
    arabic: "مُبْتَدَأ",
    definition: "Subject of a nominal sentence. Always Marfu' (ends with Damma). Usually definite."
  },
  ...
]
```

The watch page renders these as a collapsible Grammar Notes panel — a two-column card grid (term + Arabic script on the left, one-line definition on the right) that collapses to single-column on mobile. The panel only appears when `grammarNotes` exists on the episode.

**Use `recap`** — same prose markdown format as other series. For language lessons, structure the recap around the grammar concepts taught, vocabulary introduced, and exercises covered rather than thematic ideas.

The watch page panel order is: Grammar Notes → Episode Recap. Key Takeaways does not render if the field is absent.

Grammar notes are meant for quick lookup — "what was tanwin again?" — without reading the full recap. Keep definitions to one concise sentence. The Arabic field should use fully vowelled text where possible.

## Watch Page Dynamic Series Loading

`pages/watch.html` does not load all series data files upfront. It uses a small inline script to load only the data file needed for the current `?series=` URL parameter:

```js
(function () {
  var slug = new URLSearchParams(location.search).get('series') || 'change-of-heart';
  var map = {
    'change-of-heart': './data/change-of-heart-data.js?v=...',
    'madina-arabic':   './data/madina-arabic-data.js?v=...',
    // ...
  };
  var src = map[slug];
  if (src) document.write('<script src="' + src + '"><\/script>');
})();
```

When adding a new series, add its entry to this map. The version query string (`?v=YYYYMMDD-slug`) busts the browser cache when the data file changes. Update the version string whenever you publish new episodes or edit existing episode content (recap, grammar notes, etc.) for a series that is already live.

## Script Cache Busting

Script tags use query string versioning to force browsers to fetch updated files:

```html
<script src="./scripts/watch-page.js?v=20260604-grammar-notes" defer></script>
```

Update the version string on any script tag whenever its corresponding file changes and those changes need to reach users who have previously visited the page. The format is `YYYYMMDD-brief-description`. This applies to: `watch-page.js`, `series-page.js`, `utils.js`, and all data files referenced in `watch.html`'s dynamic loader map.

## Watch Progress

Watch progress is saved in browser `localStorage` by `scripts/watch-page.js`.

Storage key format:

```js
lecture-progress:${series.playlistId}:${episode.id}
```

Progress is tied to the stable YouTube video ID, not the R2 file URL. An R2 file can be replaced without resetting progress.

Important implications:

- Keep `episode.id` stable once published.
- Changing origin (e.g. from `github.io` to `improvingmuslim.com`) creates a new browser origin, so old progress does not carry over.
- Clearing browser data removes all saved progress.

The Settings page at `pages/settings.html` explains local storage and lets users reset watch history and saved items on the current device. Theme preference (`improving-muslim:theme`) is also stored in localStorage.

## Player Behavior

The watch page uses a native HTML5 `<video>` element, not a YouTube iframe. Captions use the browser's native `<track kind="captions">` support.

Mobile support includes:

- `playsinline` and `webkit-playsinline`
- `x-webkit-airplay="allow"`
- Media Session API metadata and controls where supported
- Local resume from saved progress

Do not reintroduce a custom caption overlay unless native captions become impossible to support. Test captions through the dev server or live site — they do not work over `file://`.

## Mobile Navigation

All inner pages (`/pages/...`) automatically receive a mobile back button in the top-left of the header. This is injected by `scripts/nav-state.js` at runtime — no HTML changes needed. The button is hidden on desktop via CSS (`display: none` above 600px) since desktop users have the browser back button. It calls `window.history.back()` on tap.

`nav-state.js` also tracks the last visited series URL so the "Series" link in the header always returns to the most recently viewed series rather than a static default.

## Captions And Episode Notes

Transcript files are usually pasted from YouTube-style transcript output. Convert them with:

```powershell
cmd /c "node scripts\transcript-to-vtt.js C:\path\to\pasted-text.txt > assets\captions\{series-slug}\episode-05.vtt"
```

The converter skips chapter heading lines, supports timestamps such as `0:11`, `59:55`, and `1:05:41`, and outputs WebVTT suitable for native video captions.

After generating captions, spot-check the file and verify it is reachable through the local server, not `file://`.

**Auto-generated transcripts** (e.g. from YouTube) are often noisy — misheard words, incorrect Arabic transliterations, garbled speaker names. When writing `recap` and `grammarNotes` from these transcripts, interpret the content based on context rather than transcribing literally.

Episode objects can include any combination of these note fields:

```js
captionsSrc: "./assets/captions/series-slug/episode-01.vtt",
takeaways: ["..."],         // Islamic lecture series only
grammarNotes: [...],        // Language course series only
recap: `# Section heading\n\nProse...`
```

The watch page shows panels only for fields that exist on the episode object. Nothing breaks if a field is absent.

## Speaker Pages And Ordering

The homepage shows a compact speaker strip. `pages/speakers.html` is the full directory.

Speaker ordering is controlled in `data/speaker-data.js`. Prioritize speakers with fully or partially hosted series on the platform.

Speaker photos belong in `assets/speaker/`. Series thumbnails should remain separate from speaker portraits unless a real series image is not available yet.

## Feedback And Error Emails

Every page footer links to `pages/feedback.html`. Feedback form submissions POST to FormSubmit at `contact@improvingmuslim.com`.

`scripts/error-handler.js` uses the same FormSubmit endpoint to silently report production JS crashes. Both use the same confirmed endpoint. FormSubmit may require re-confirmation if the endpoint has been inactive — check the inbox if emails stop arriving.

Do not link public feedback to a personal GitHub profile while the project is intended to stay anonymous.

## UI And Accessibility Direction

The site should feel quiet, focused, and useful for repeated study rather than like a marketing landing page.

Current UX principles:

- Keep mobile real estate precious. Avoid noisy metadata when it does not help the learner choose what to watch.
- Returning users should see low-friction resume paths through continue-watching cards and saved progress.
- Desktop can use richer sidebars; mobile should show equivalent episode navigation below the player or through compact controls.
- Support light, dark, and system themes from Settings.
- Respect `prefers-reduced-motion`.
- Use local image assets for predictable rendering and privacy.
- Use native browser video features: captions, playback controls, picture-in-picture, and Media Session API.

When changing UI, run the accessibility checks and inspect at least one mobile-width viewport.

## Local Development

```bash
npm run dev
```

This runs `python -m http.server 4173`. Open `http://localhost:4173/`.

Run checks before pushing:

```bash
npm run check
```

`npm run check` runs `check:js` (Node.js syntax check on all JS and data files) and `check:a11y` (accessibility audit of all HTML pages: missing titles, duplicate IDs, unlabeled images/buttons/inputs, unsafe external links, heading hierarchy).

## Deployment Workflow

Prefer local iteration. Push only clean milestones to avoid noisy history.

Before pushing:

1. Run `npm run check` — must pass cleanly.
2. Verify important browser flows locally when UI or player code changes.
3. Commit a focused milestone with a clear message.
4. Push to `main`.

After pushing:

5. Check the Actions tab on GitHub to confirm the CI run is green.
6. If CI fails, fix the issue and push a new commit — do not force-push.

GitHub Pages deploys from `main` root automatically on every push. CI runs in parallel — a red CI run means something is broken in production even if the deploy succeeded.
