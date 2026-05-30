# Developer Notes

This project is intentionally a plain HTML, CSS, and JavaScript site. Do not reintroduce React, Vite, or a build step unless the project direction explicitly changes.

This document is a living guide. The architecture, hosting choices, and workflow are expected to evolve as the platform grows. Treat these notes as current project context, not a rigid rulebook. Update this file whenever the actual workflow changes.

## Project Shape

- `index.html` is the main collection page.
- `script.js` renders homepage speakers, categories, and series cards.
- `styles.css` contains all site styling.
- `series-change-of-heart.html` is the first dedicated series page.
- `series-page.js` renders the Change of Heart episode list.
- `watch.html` is the focused video player page.
- `watch-page.js` loads the selected episode, handles native playback, progress saving, and media-session controls.
- `change-of-heart-data.js` is the data source for the Change of Heart series.
- `assets/captions/change-of-heart/` contains WebVTT captions for uploaded Change of Heart episodes.
- `scripts/transcript-to-vtt.js` converts pasted YouTube-style transcripts into short WebVTT cues.
- `assets/thumbnail/` and `assets/speaker/` contain local image assets.
- `CNAME` pins the GitHub Pages custom domain to `improvingmuslim.com`.

## Current Content State

The first active series is:

```txt
Change of Heart
Speaker: Ali Hammuda
Topic/category: Purification of the Heart
```

For now, only episodes 1-5 are treated as watchable on the platform. They have R2-hosted MP4 files, captions where transcripts have been processed, and episode learning material in `change-of-heart-data.js`.

Episodes 6-16 remain visible as the future roadmap for the series, but they should not link to broken placeholder videos. These planned episodes use:

```js
statusNote: "Video not added yet. It will be uploaded in the future, insha'Allah."
```

Do not add local placeholder `videoSrc` values such as `./assets/videos/...` for episodes that are not actually uploaded. The UI treats an episode with no `videoSrc` as unavailable and displays an `Uploading soon` label.

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

Do not commit real video files to the repository. The `assets/videos/change-of-heart/.gitkeep` file only preserves the intended local folder structure.

## Episode Publishing Workflow

When adding a new watchable episode:

1. Upload the MP4 to Cloudflare R2 using the naming pattern above.
2. Confirm the public R2 URL responds successfully.
3. Update the matching episode object in `change-of-heart-data.js` with `videoSrc`.
4. If a transcript is available, generate a VTT file under `assets/captions/change-of-heart/`.
5. Add `captionsSrc` to the episode object.
6. Add `takeaways` and `recap` in the same style as episodes 1-5.
7. Keep `episode.id` unchanged so watch progress does not reset.
8. Run syntax checks and test locally through the dev server.

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

## Watch Progress

Watch progress is saved in browser `localStorage` by `watch-page.js`.

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

Change of Heart episode thumbnails currently use YouTube thumbnail CDN URLs generated from episode IDs:

```js
https://i.ytimg.com/vi/${episode.id}/mqdefault.jpg
https://i.ytimg.com/vi/${episode.id}/hqdefault.jpg
```

If the platform should become fully independent from YouTube, move episode thumbnails to local assets or R2 and update the helper functions in `watch-page.js` and `series-page.js`.

## Captions And Episode Notes

Transcript files are usually pasted from YouTube-style transcript output. Convert them with:

```powershell
cmd /c "node scripts\transcript-to-vtt.js C:\path\to\pasted-text.txt > assets\captions\change-of-heart\episode-05.vtt"
```

The converter:

- Skips chapter heading lines.
- Supports timestamps such as `0:11`, `59:55`, and `1:05:41`.
- Splits captions into short cues, currently capped at 8 words per cue.
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
node --check script.js
node --check series-page.js
node --check watch-page.js
node --check change-of-heart-data.js
node --check scripts\transcript-to-vtt.js
```

## Deployment Workflow

Prefer local iteration. Push only clean milestones to avoid noisy history.

Before pushing:

1. Check `git status --short`.
2. Run JS syntax checks.
3. Verify important browser flows locally when UI/player code changes.
4. Commit a focused milestone.
5. Push to `main`.

GitHub Pages deploys from `main` root automatically.
