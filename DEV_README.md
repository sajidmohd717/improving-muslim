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

The active self-hosted series are:

```txt
Change of Heart
Speaker: Ali Hammuda
Topic/category: Purification of the Heart
Watchable: episodes 1-5

Enjoy Your Prayer
Speaker: Ali Hammuda
Topic/category: Salah & Worship
Watchable: episodes 1-8

40 Hadith of Imam Nawawi
Speaker: Navaid Aziz
Topic/category: Hadith
Watchable: episodes 1-3
```

For Change of Heart, episodes 1-5 have R2-hosted MP4 files, native VTT captions, key takeaways, and episode recaps in `data/change-of-heart-data.js`.

Episodes 6-16 remain visible as the future roadmap for the series, but they should not link to broken placeholder videos. These planned episodes use:

```js
statusNote: "Video not added yet. It will be uploaded in the future, insha'Allah."
```

Do not add local placeholder `videoSrc` values such as `./assets/videos/...` for episodes that are not actually uploaded. The UI treats an episode with no `videoSrc` as unavailable and displays an `Uploading soon` label.

Enjoy Your Prayer has 21 listed episodes. Episodes 1-8 are currently unlocked with R2-hosted MP4 files. Episodes 9-21 remain visible as `Uploading soon`.

40 Hadith of Imam Nawawi has 46 listed episodes. Episodes 1-3 are currently unlocked with R2-hosted MP4 files. Later episodes remain visible as `Uploading soon` until their `videoSrc` is added.

Why Me is currently a visible catalogue/roadmap series only. It has local episode thumbnails but no watchable MP4 files yet.

The homepage topic order should stay intentional and learning-led. Current main topics include All, Purification, Prayer, Hadith, and Tafsir. Series should appear in the topic that best matches the learner's intent, not merely the speaker or source playlist.

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

Use this flow when bringing in a new series:

1. Pick a stable kebab-case `series.slug`, for example `forty-hadith-nawawi`.
2. Add `data/{series-slug}-data.js` with `title`, `slug`, `seriesPageUrl`, `speaker`, `topic`, `thumbnailSrc`, `episodeThumbnailPath`, `playlistId`, `description`, and `episodes`.
3. Add a dedicated series page in `pages/series-{series-slug}.html` that loads the data file and `scripts/series-page.js`.
4. Add the series to the homepage data/rendering in `scripts/script.js`, including the correct category.
5. Add or update speaker metadata in `data/speaker-data.js`.
6. If the speaker needs a profile page, make sure `pages/speaker.html` can resolve the speaker slug and that the speaker is listed in `pages/speakers.html`.
7. Add local series artwork and local episode thumbnails under `assets/thumbnail/{series-slug}/`.
8. Add R2 `videoSrc` only for episodes that have actually been uploaded.
9. Run `npm run check` and test the homepage, series page, watch page, speaker page, settings page, and mobile layout.

Series pages are static HTML shells, but episode lists are data-driven. Prefer adding data and letting shared scripts render the repeated UI rather than hand-writing each episode card.

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

Every page footer links to `pages/feedback.html`. The current static implementation opens the user's email app and addresses feedback to:

```txt
feedback@improvingmuslim.com
```

Set up Cloudflare Email Routing, a mailbox, or a privacy-preserving form backend for that address before relying on it in production. Do not link public feedback to a personal GitHub profile while the project is intended to stay anonymous.

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
