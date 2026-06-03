# Developer Notes

This project is intentionally a plain HTML, CSS, and JavaScript site. Do not reintroduce React, Vite, or a build step unless the project direction explicitly changes.

This document is a living guide. The architecture, hosting choices, and workflow are expected to evolve as the platform grows. Treat these notes as current project context, not a rigid rulebook. Update this file whenever the actual workflow changes.

## Project Shape

- `index.html` stays at the repository root because GitHub Pages serves it as the entry point.
- `pages/` contains secondary HTML pages such as series pages, speaker profiles, settings, about, and watch.
- `scripts/` contains browser logic and utility scripts.
- `data/` contains series and speaker data files.
- `styles/styles.css` contains all site styling.
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
- `assets/thumbnail/` and `assets/speaker/` contain local image assets.
- `public/` contains brand-facing assets: logo/favicons, the web manifest, and the default social sharing preview image.
- `CNAME` pins the GitHub Pages custom domain to `improvingmuslim.com`.

Moved pages include a `<base href="../" />` tag. Keep project links in the form `./pages/...`, `./scripts/...`, `./data/...`, `./assets/...`, and `./styles/...` so links work from both `index.html` and moved pages.

## Current Content State

The platform currently has 12 series registered. All are self-hosted via Cloudflare R2 or referenced from the registry:

| Series | Speaker | Category | Status |
|---|---|---|---|
| Change of Heart | Ali Hammuda | Purification | Partially unlocked |
| Enjoy Your Prayer | Ali Hammuda | Prayer | Partially unlocked |
| 40 Hadith of Imam Nawawi | Navaid Aziz | Hadith | Partially unlocked |
| Seerah of Prophet Muhammed (S) | Yasir Qadhi | Seerah | Partially unlocked |
| Heart Matters Ramadan Series 2023 | Yasir Qadhi | Purification | Partially unlocked |
| Angels in Your Presence | Omar Suleiman | Angels | Partially unlocked |
| 10 Promised Jannah | AbdulRahman Hassan | Sahaba | Partially unlocked |
| The Message of the Quran in 30 Lessons | Yasir Qadhi | Quran | Partially unlocked |
| The Parables of The Quran | Yasir Qadhi | Quran | Partially unlocked |
| Why Me? | Omar Suleiman | Purification | Catalogue only |

Episodes without an uploaded R2 MP4 should not have a `videoSrc`. The UI automatically shows them as `Uploading soon`. Do not add placeholder local paths.

```js
statusNote: "Video not added yet. It will be uploaded in the future, insha'Allah."
```

The homepage topic order should stay intentional and learning-led. Series should appear in the topic that best matches the learner's intent, not merely the speaker or source playlist.

## Hosting

The static website is deployed with GitHub Pages from the `main` branch root.

Current public URLs:

- GitHub Pages URL: `https://sajidmohd717.github.io/islamic-lectures-react/`
- Custom domain: `https://improvingmuslim.com` once GitHub HTTPS provisioning is complete.

Videos are not stored in Git. Large MP4 files are hosted on Cloudflare R2 and referenced by URL in the episode data.

## Video Hosting Pattern

R2 bucket:

```txt
islamic-lectures-videos
```

Public R2 base URL:

```txt
https://pub-276a3999c8d2451dad841d712cdb5ca0.r2.dev
```

Object naming pattern:

```txt
change-of-heart/change-of-heart-ep-1.mp4
change-of-heart/change-of-heart-ep-2.mp4
...
```

Episode data should point to R2 URLs:

```js
videoSrc: "https://pub-276a3999c8d2451dad841d712cdb5ca0.r2.dev/change-of-heart/change-of-heart-ep-1.mp4"
```

New series should use the folder/object pattern:

```txt
series-slug/series-slug-ep-1.mp4
series-slug/series-slug-ep-2.mp4
```

Do not commit real video files to the repository. The `assets/videos/change-of-heart/.gitkeep` file only preserves the intended local folder structure.

## Episode Publishing Workflow

When adding a new watchable episode:

1. Upload the MP4 to Cloudflare R2 using the naming pattern above.
2. Confirm the public R2 URL responds successfully.
3. Update the matching episode object in the relevant `data/*-data.js` file with `videoSrc`.
4. If a transcript is available, generate a VTT file under `assets/captions/{series-slug}/`.
5. Add `captionsSrc` to the episode object.
6. Add `takeaways` and `recap` when the transcript has been reviewed enough to produce useful notes.
7. Keep `episode.id` unchanged so watch progress does not reset.
8. Make sure the local episode thumbnail exists as `assets/thumbnail/{series-slug}/episodes/episode-XX.jpg`.
9. Run syntax checks and test locally through the dev server.

When an episode is not uploaded yet:

- Do not set `videoSrc`.
- Add or keep `statusNote`.
- Let the series page and watch sidebar show it as `Uploading soon`.

## Uploading Large Videos To R2

Cloudflare's dashboard uploader has a 300 MB limit. Use the S3-compatible API for larger files.

Configure AWS CLI with an R2 profile:

```powershell
aws configure --profile r2
```

Use:

```txt
Default region name: auto
Default output format: json
```

Upload or overwrite an object:

```powershell
aws s3 cp "C:\Users\sajid\Downloads\change-of-heart-ep-1.mp4" "s3://islamic-lectures-videos/change-of-heart/change-of-heart-ep-1.mp4" --profile r2 --endpoint-url "https://995f2e2da1ff1e87964b10dfba768477.r2.cloudflarestorage.com"
```

Never commit or paste production R2 secrets into the repository or docs.

## Adding A New Series

All series registration flows through `data/series-registry.js`. Adding a new series no longer requires touching `scripts/script.js`, `scripts/watch-page.js`, `scripts/history-page.js`, or `scripts/speaker-page.js` — those all derive their series lists from the registry automatically.

### Step 1 — Create the data file

Add `data/{series-slug}-data.js`. Required fields:

```js
window.myNewSeries = {
  title: "Series Title",
  slug: "series-slug",
  seriesPageUrl: "./pages/series-series-slug.html",
  speaker: "Speaker Name",
  topic: "Category Display Name",   // shown in the hero eyebrow
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

`category` must match one of the values in the `categories` array in `scripts/script.js` (e.g. `purification`, `prayer`, `hadith`, `seerah`, `quran`, `angels`, `sahaba`). `sectionTitle` is the heading that groups series on the homepage — multiple series can share the same `sectionTitle`.

### Step 3 — Create the series page

Copy an existing `pages/series-*.html` as a starting point. Only three things change per series:

1. The `<head>` meta tags (title, description, og:title, og:description, og:image, og:url, twitter:*)
2. The `<p class="hero-copy">` — write crafted prose describing the series (this stays in HTML for editorial control; everything else in the hero is rendered from the data file)
3. The three bottom script lines:

```html
<script src="./data/series-slug-data.js"></script>
<script>window.currentSeries = window.myNewSeries;</script>
<script src="./scripts/series-page.js" defer></script>
```

The hero eyebrow, h1, thumbnail, episode count, and start link are all populated automatically by `renderHero()` in `scripts/series-page.js`.

### Step 4 — Add the data file script tag to shared pages

Add one `<script>` tag to each of these four pages, alongside the existing data file tags:

- `index.html`
- `pages/watch.html`
- `pages/history.html`
- `pages/speaker.html`

```html
<script src="./data/series-slug-data.js"></script>
```

### Step 5 — Add assets and speaker

- Series thumbnail: `assets/thumbnail/{series-slug}/series-card.jpg` (referenced by `thumbnailSrc`)
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

Series pages are static HTML shells. Episode lists, hero content, watch routing, history tracking, and speaker page listings are all data-driven from the data file and registry.

## Watch Progress

Watch progress is saved in browser `localStorage` by `scripts/watch-page.js`.

Storage key format:

```js
lecture-progress:${series.playlistId}:${episode.id}
```

Progress is intentionally tied to stable episode IDs, not video file URLs. This means an R2 file can be replaced without resetting user progress.

Important implications:

- Keep `episode.id` stable once public.
- Changing from `github.io` to `improvingmuslim.com` creates a new browser origin, so old progress from the GitHub Pages URL will not carry over.
- Clearing browser data removes saved progress.
- Future account-based progress would need a backend.

The Settings page at `pages/settings.html` explains local storage and lets users reset watch history on the current device.

Settings also includes a theme selector. `scripts/theme.js` applies `system`, `light`, or `dark` mode using `localStorage` key `improving-muslim:theme`.

## Player Behavior

The watch page uses a native HTML5 `<video>` element, not a YouTube iframe. This avoids YouTube embed errors and keeps the experience focused.

Captions use the browser's native `<track kind="captions">` support. Do not reintroduce a custom caption overlay unless native captions become impossible to support. The native captions menu may not appear when opening `watch.html` directly as a `file://` page; test captions through `npm run dev`, GitHub Pages, or the custom domain.

Mobile support currently includes:

- `playsinline`
- `webkit-playsinline`
- `x-webkit-airplay="allow"`
- Media Session API metadata and controls where supported
- local resume behavior

Browser and OS rules still decide whether background or lock-screen playback continues. The site can support those APIs, but it cannot force YouTube Premium-style background playback everywhere.

## Thumbnail Sources

Homepage series thumbnails and speaker photos mostly use local assets.

Episode thumbnails and video posters must not depend on YouTube's thumbnail CDN at runtime. Series data should provide:

```js
thumbnailSrc: "./assets/thumbnail/{topic-or-series}/series-image.jpg",
episodeThumbnailPath: "./assets/thumbnail/{series-slug}/episodes",
```

Episode artwork should be saved as:

```txt
assets/thumbnail/{series-slug}/episodes/episode-01.jpg
assets/thumbnail/{series-slug}/episodes/episode-02.jpg
...
```

The shared helpers in `scripts/script.js`, `scripts/series-page.js`, and `scripts/watch-page.js` resolve episode images from `episodeThumbnailPath`. Individual episodes can still override this with their own local `thumbnailSrc` when a custom image is needed.

It is acceptable to download source thumbnails from YouTube during development, but the committed site should load local files. After adding thumbnails, search for `i.ytimg.com` and remove runtime references.

The UI also includes `prefers-reduced-motion` handling. When adding animations, hover transforms, shimmer effects, or scrolling behavior, make sure they are disabled or reduced inside the reduced-motion media query.

## Captions And Episode Notes

Transcript files are usually pasted from YouTube-style transcript output. Convert them with:

```powershell
cmd /c "node scripts\transcript-to-vtt.js C:\path\to\pasted-text.txt > assets\captions\{series-slug}\episode-05.vtt"
```

The converter:

- Skips chapter heading lines.
- Supports timestamps such as `0:11`, `59:55`, and `1:05:41`.
- Outputs WebVTT suitable for native video captions.

After generating captions, spot-check:

```powershell
node --check scripts\transcript-to-vtt.js
```

Then verify the VTT file is reachable through the local server, not `file://`.

Episode objects can include:

```js
captionsSrc: "./assets/captions/change-of-heart/episode-05.vtt",
takeaways: ["..."],
recap: `# Powerful Recap: ...`
```

The watch page automatically shows Key Takeaways and Recap panels when those fields exist.

If the pasted transcript already has good timestamps, preserve those timings. Do not split or rewrite captions merely to force a word count. Native captions should track the provided transcript timing as closely as possible.

## Speaker Pages And Ordering

The homepage shows a compact speaker strip. `pages/speakers.html` is the full directory.

Speaker ordering is controlled in `data/speaker-data.js`. Prioritize speakers with fully or partially hosted series on the platform. Currently Navaid Aziz should appear after Ali Hammuda because the platform has watchable Ali Hammuda series and the first uploaded Navaid Aziz series.

Speaker photos belong in `assets/speaker/`. Series thumbnails should remain separate from speaker portraits unless a real series image is not available yet.

## Feedback

Every page footer links to `pages/feedback.html`. The current static implementation posts to a FormSubmit AJAX endpoint for:

```txt
contact@improvingmuslim.com
```

The exact receiving address must be active and monitored. FormSubmit may require the first submission to be confirmed from that inbox before delivery starts, so check the inbox and spam folder after changing the endpoint. Do not link public feedback to a personal GitHub profile while the project is intended to stay anonymous.

## UI And Accessibility Direction

The site should feel quiet, focused, and useful for repeated study rather than like a marketing landing page.

Current UX principles:

- Keep mobile real estate precious. Avoid noisy metadata when it does not help the learner choose what to watch.
- Returning users should see low-friction resume paths through continue-watching cards and saved progress.
- Desktop can use richer sidebars; mobile should show equivalent episode navigation below the player or through compact controls.
- Support light, dark, and system themes from Settings.
- Respect `prefers-reduced-motion`.
- Use local image assets for predictable rendering and privacy.
- Use native browser video features where possible: captions, playback controls, picture-in-picture, and Media Session API.

When changing UI, run the accessibility checks and inspect at least one mobile-width viewport.

## Local Development

Install dependencies only for the convenience script:

```bash
npm run dev
```

This runs:

```bash
python -m http.server 4173
```

Then open:

```txt
http://localhost:4173/
```

Run syntax checks before pushing:

```powershell
npm run check
```

`npm run check` runs JavaScript syntax checks and `scripts/check-a11y.js`, which scans every static page for common accessibility issues such as missing page titles, duplicate IDs, unlabeled images/buttons/inputs, and unsafe external links.

## Deployment Workflow

Prefer local iteration. Push only clean milestones to avoid noisy history.

Before pushing:

1. Check `git status --short`.
2. Run `npm run check`.
3. Verify important browser flows locally when UI/player code changes.
4. Commit a focused milestone.
5. Push to `main`.

GitHub Pages deploys from `main` root automatically.
