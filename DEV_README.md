# Improving Muslim Developer Guide

This project is intentionally a plain HTML, CSS, and JavaScript site. It does not use React. Do not introduce a client framework or application bundler unless the project direction explicitly changes. Small authoring-time generators and validation scripts are part of the current architecture, but production remains deployable as static files.

This document is a living guide. The architecture, hosting choices, and workflow are expected to evolve as the platform grows. Treat these notes as current project context, not a rigid rulebook. Update this file whenever the actual workflow changes.

## Project Shape

- `index.html` stays at the repository root because GitHub Pages serves it as the entry point.
- `pages/` contains maintained secondary page templates and query-string compatibility routes such as series detail, watch, speaker profiles, settings, and about.
- `series/` and `watch/` contain canonical, crawlable pages generated from the maintained templates and catalog data by `scripts/generate-seo-pages.js`. Never edit generated pages by hand.
- `scripts/` contains browser logic and utility scripts.
- `data/` contains series and speaker data files.
- `styles/styles.css` is the CSS entry point — it only `@import`s focused sub-files from `styles/`. Do not add rules directly to `styles.css`; add them to the appropriate sub-file and bump that import's `?v=` version.
- `scripts/home-config.js` holds homepage categories, curated descriptions, remote-feed exclusions, and the `catalogVersion` cache key. Bump `catalogVersion` whenever the remote catalog JSON changes.
- `scripts/script.js` loads, merges, sorts, and renders homepage series and standalone lecture cards. Keep static homepage metadata in `home-config.js` when possible so this controller stays focused on behavior.
- `scripts/home-search.js` owns homepage search behavior: suggestions while typing, submit-only search, result matching, and the search-mode handoff back to `script.js`.
- `pages/speakers.html` is the full speaker directory, linked from the bottom navigation.
- `scripts/series-page.js` renders dedicated series episode lists.
- `pages/watch.html` is the focused video player page — handles both series episodes (`?series=&video=`) and standalone lectures (`?lecture=`).
- `scripts/watch-page.js` loads the selected episode or standalone lecture, handles native playback, progress saving, completion state, stall detection, media-session controls, and the per-episode "My Notes" panel. See the My Notes section below.
- `data/series-registry.js` is the central series registry — the single source of truth for all series slugs, categories, and global keys.
- `data/*-data.js` files are the series data sources.
- `data/standalone-lectures-data.js` holds all standalone (non-series) lecture objects in a single `window.standaloneLectures` array.
- `data/speaker-data.js` controls speaker ordering and profile metadata.
- `data/catalog-data.js` is a generated flat index of every watchable episode and standalone lecture, each with normalized metadata and a TF-IDF term vector (built from titles, descriptions, keywords, takeaways, recaps, and caption transcripts). Never edit by hand — regenerate with `npm run catalog` after any content change, and CI verifies it with `npm run check:catalog`.
- `scripts/generate-catalog.js` builds `data/catalog-data.js` from the registry, series data files, standalone lectures, and `assets/captions/`.
- `scripts/related-videos.js` is the pure ranking module (`window.IMRelated.rankRelated`) behind the watch page's "Related lectures" sidebar: term-vector cosine similarity, category overlap, same-speaker and recency boosts, watched demotion, and per-series/per-speaker diversity caps. Loaded on the watch template before `watch-page.js`, which renders the results (and, for standalone lectures, uses the top result as the "Up next" card and autoplay-next target).
- `scripts/firebase-auth.js` handles Google sign-in, Firestore sync, and exposes `window.IMAuth`. Loaded on all pages. See the Firebase Authentication section below.
- `scripts/streak-ui.js` handles the nav streak button, streak panel, monthly heatmap, and public leaderboard UI. It loads after `utils.js` and before `firebase-auth.js`.
- `pages/admin.html` is a direct-link private admin dashboard. It currently reads submitted search analytics for allowlisted admin emails only.
- `assets/captions/` contains WebVTT captions, grouped by series slug or `standalone/{speaker-slug}/`.
- `assets/thumbnail/standalone/{speaker-slug}/` holds standalone lecture thumbnails.
- `scripts/transcript-to-vtt.js` converts pasted YouTube-style transcripts into WebVTT cues.
- `scripts/publish.ps1` is the YouTube-to-R2 publisher (download, faststart fix, upload, and series data patching; standalone metadata remains editorial). See the Uploading Large Videos To R2 section below.
- `scripts/check-a11y.js` scans every static HTML page for common accessibility issues.
- `scripts/generate-seo-pages.js` and `scripts/generate-sitemap.js` generate canonical content routes and `sitemap.xml`; their `--check` modes keep committed output current.
- `scripts/error-handler.js` catches unhandled JS errors and promise rejections, shows a friendly fallback UI, and silently reports crashes to `contact@improvingmuslim.com` via FormSubmit. It is currently loaded on the heavy interactive pages (index, history, saved, watch) — load it first, before all other scripts, on any page that includes it.
- `scripts/nav-state.js` tracks the last visited series URL for the "Series" nav link, and injects the mobile back button on all inner pages.
- `pages/explore.html` is the explore/browse page with topic-based filtering across series and standalone videos.
- `scripts/explore-page.js` drives the explore page — filters, topic counts, and card rendering.
- `styles/explore.css` contains explore-page-specific styles.
- `assets/thumbnail/` and `assets/speaker/` contain local image assets.
- `public/` contains brand-facing assets: logo/favicons, the web manifest, and the social sharing preview image.
- `public/social-preview-template.html` is the source template for regenerating `public/social-preview.png`. See the Social Preview Image section below.
- `.github/workflows/check.yml` runs the complete validation suite automatically on every push and pull request to `main`.
- `CNAME` pins the GitHub Pages custom domain to `improvingmuslim.com`.

All pages in `pages/` include a `<base href="../" />` tag. Keep all project links in the form `./pages/...`, `./scripts/...`, `./data/...`, `./assets/...`, and `./styles/...` so links resolve correctly from both `index.html` and inner pages.

## Current Content State

Snapshot as of 11 July 2026: the catalog has 11 series and 20 standalone lectures. Seventy series episodes and all 20 standalone lectures are currently watchable, for 90 hosted lectures in total. Treat `data/series-registry.js` and the episode data files as authoritative; this table is a human-readable snapshot and should be updated when upload milestones change.

### Series

| Series | Speaker | Category | Watchable |
|---|---|---|---|
| Enjoy Your Prayer | Ali Hammuda | Prayer | 8 / 21 |
| Fortress of the Muslim | Assim Al-Hakeem | Dhikr | 5 / 13 |
| Seerah of the Prophet (S) | Yasir Qadhi | Seerah | 5 / 104 |
| 40 Hadith of Imam Nawawi | Navaid Aziz | Hadith | 4 / 46 |
| Change of Heart | Ali Hammuda | Purification | 10 / 16 |
| Why Me? | Omar Suleiman | Purification | 13 / 30 |
| Angels in Your Presence | Omar Suleiman | Angels | 11 / 30 |
| Life of Muhammad (PBUH) | Mufti Menk | Seerah | 8 / 30 |
| 10 Promised Jannah | AbdulRahman Hassan | Sahaba | 0 / 10 |
| Madina Arabic Books | Asif Meherali | Arabic | 3 / 123 |
| Page by Page Tafseer | Ahsan Hanif | Quran | 3 / 604 |

### Standalone Lectures

| Title | Speaker | Category | Video |
|---|---|---|---|
| Qadr & Sabr | Belal Assaad | Purification | Uploaded |
| Purpose of Creation | Mufti Menk | Purification | Uploaded |
| Why Am I Here? | Hisham Abu Yusuf | Purification | Uploaded |
| Allah's Words to Musa Were Meant for You Too | Abu Bakr Zoud | Quran | Uploaded |
| Only Allah Knows What You Went Through | Omar Suleiman | Purification | Uploaded |
| DUA: How to Get Your Dreams! | Yahya Al-Raaby | Dua | Uploaded |
| A Poem To Soften The Hardened Heart | Abu Taymiyyah | Purification | Uploaded |
| Effect of the Quran in Our Life | Abu Bakr Zoud | Quran | Uploaded |
| The Qur'an and Depression | Omar Suleiman | Quran | Uploaded |
| Ahmed the Repenter | Belal Assaad | Purification | Uploaded |
| The Story of the 3 Trapped Men | Belal Assaad | Purification | Uploaded |
| The 4 Stages of Allah's Guidance | Belal Assaad | Quran | Uploaded |
| Can a Muslim Get Rich? | Belal Assaad | Purification | Uploaded |
| Quran — Your Best Companion | Yahya Al-Raaby | Quran | Uploaded |
| The Story of Prophet Zakariya & His Powerful Dua | Majed Mahmoud | Prophets | Uploaded |
| The Story of Prophet Yunus & the People of Ninevah | Majed Mahmoud | Prophets | Uploaded |
| The Story of Prophet Ayyub & His Beautiful Patience | Majed Mahmoud | Prophets | Uploaded |
| Why You Should Never Give Up on Du'aa | Majed Mahmoud | Dhikr | Uploaded |
| 6 Lessons From the Destroyed Garden | Abu Taymiyyah | Quran | Uploaded |
| 10 Lessons From Musa & Khidr in Surat al-Kahf | Abu Taymiyyah | Quran | Uploaded |


Episodes without an uploaded R2 MP4 should not have a `videoSrc`. The UI automatically shows them as `Uploading soon`. Do not add placeholder local paths.

```js
statusNote: "Video not added yet. It will be uploaded in the future, insha'Allah."
```

The homepage feed default is a fresh shuffle per visit — an intentional product decision for fair discovery, so no series is permanently buried below the fold. Do not "fix" this by making the default order stable. The curated registry order remains available as the "Featured order" sort option, and the continue-watching hero always renders above the feed for returning users. Series should still be assigned to the topic that best matches the learner's intent, not merely the speaker or source playlist.

## CI / Automated Checks

Every push and pull request to `main` triggers `.github/workflows/check.yml`, which runs on a clean Ubuntu environment:

1. `npm run check:js` — syntax check of every file in `scripts/` and `data/` (auto-discovered, no list to maintain).
2. `npm run check:a11y` — custom accessibility audit of the maintained HTML page templates.
3. `npm run check:seo-pages` — fails if any generated series or watch route is stale.
4. `npm run check:sitemap` — fails if sitemap.xml is out of date with the series registry (fix with `npm run sitemap`).
5. `npm run check:vtt` — fails if any committed WebVTT caption still carries left-pinning positioning cue settings (fix with `npm run clean-vtt`).
6. `npm run check:smoke` — Playwright coverage for homepage rendering, search/filtering, generated series-to-watch navigation, runtime errors, and the 390px keyboard-accessible menu.

If any step fails, GitHub marks the run red. Check the repository's Actions tab after each push to confirm it is green.

The same checks can be run locally before pushing:

```bash
npm run check
```

After the first dependency install, run `npx playwright install chromium` once to install the local browser used by the smoke tests. CI installs Chromium automatically.

Do not skip the checks before pushing. A red CI run means something is broken in production.

## Error Handler and Monitoring

`scripts/error-handler.js` is loaded on the heavy interactive pages (index, history, saved, watch). On any page that includes it, it must be the first script, before all other scripts including `utils.js`. It:

- Registers `window.onerror` and `window.addEventListener('unhandledrejection', ...)` before anything else can crash.
- Shows a friendly fallback UI inside `<main>` if a script error occurs, rather than leaving the user with a blank or broken page.
- Silently POSTs error details (message, page URL, browser) to `contact@improvingmuslim.com` via FormSubmit — fire and forget, never surfaced to the user.
- Filters out non-crash rejections: `AbortError` (fetch cancelled on navigation), network `TypeError`s (Safari "Load failed", Chrome "Failed to fetch"), and any rejection that fires while `document.hidden` is true (bfcache artifacts).
- Resets its state on `pageshow` with `persisted: true` so Safari's back-forward cache restoration never incorrectly triggers the fallback UI.

**Video stall detection** is built into `scripts/watch-page.js`. If a video has buffered zero data after 20 seconds, it shows a friendly error message and silently fires the same FormSubmit report with the subject `Video stall: /pages/watch.html` and the exact `videoSrc` URL. This catches structural file issues (e.g. moov atom at end of file) without the user needing to report it manually.

**FormSubmit note:** The first email from a new endpoint requires a one-time confirmation click from `contact@improvingmuslim.com`. If error reports stop arriving, check the inbox for a re-confirmation request.

## Hosting

The static website is deployed with GitHub Pages from the `main` branch root.

- GitHub Pages URL: `https://sajidmohd717.github.io/improving-muslim/`
- Custom domain: `https://improvingmuslim.com`

Videos are not stored in Git. Large MP4 files are hosted on Cloudflare R2 and referenced by URL in the episode data.

## AI Search

Homepage search is submit-based: suggestions appear while typing, then the dedicated search results state renders after Enter or the Search button. The browser always has a normal local keyword fallback, so search should keep working even if AI is not configured.

AI reranking is enabled through a Cloudflare Worker endpoint configured in `scripts/home-config.js`:

```js
aiSearchEndpoint: "https://improving-muslim-ai-search.improving-muslim.workers.dev"
```

Never put a DeepSeek, OpenAI, Claude, or other private AI API key in browser JavaScript. The browser only sends the user's submitted query plus trimmed catalog metadata to the Worker. The Worker calls the active provider with its server-side secret and returns ranked item IDs.

Current production Worker:

| Field | Value |
|---|---|
| Worker name | `improving-muslim-ai-search` |
| Worker URL | `https://improving-muslim-ai-search.improving-muslim.workers.dev` |
| Source file | `workers/ai-search-worker.js` |
| Wrangler config | `wrangler.jsonc` |
| Active provider | `deepseek` |
| Required secret | `DEEPSEEK_API_KEY` |
| Public vars | `ALLOWED_ORIGIN=https://improvingmuslim.com`, `AI_PROVIDER=deepseek`, `DEEPSEEK_MODEL=deepseek-v4-flash` |

### AI Search Runtime Flow

1. User types in the homepage search box.
2. `scripts/home-search.js` shows suggestions only; it does not rerender the whole feed on every keystroke.
3. User presses Enter or clicks Search.
4. `scripts/script.js` immediately renders normal local keyword results, logs the submitted search event when signed in, and starts the AI rerank request in the background.
5. The Worker receives `{ query, items }`, validates CORS/origin, calls the active AI provider, and returns ranked IDs.
6. If ranked IDs come back, the homepage reorders/filters results and shows an "AI match" badge.
7. If the Worker fails, the active provider is unavailable, or no useful IDs come back, the homepage keeps the normal local search results.

This means AI search should enhance search quality without being a single point of failure.

### Deploying The Worker

Use Wrangler from the repo root:

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

The secret is stored in Cloudflare, not Git. `.env`, `.dev.vars`, and `.wrangler/` are ignored in `.gitignore`; keep it that way.

The Worker also still has an inactive OpenAI code path. To switch back later, set `AI_PROVIDER=openai`, require/store `OPENAI_API_KEY`, and set `OPENAI_MODEL`. Do not keep both providers active from browser code; provider choice belongs inside the Worker.

To test the live Worker without the browser:

```powershell
$json = '{"query":"money in islam","items":[{"id":"video:test-money","title":"Money and Riba in Islam","speaker":"Test Speaker","topic":"Finance","type":"video","text":"A lecture about money, riba, halal income, and Islamic finance."},{"id":"video:test-prayer","title":"How to Improve Salah","speaker":"Test Speaker","topic":"Prayer","type":"video","text":"A lecture about prayer focus and khushu."}]}'
$json | curl.exe -k -sS -i -X POST "https://improving-muslim-ai-search.improving-muslim.workers.dev" -H "Content-Type: application/json" -H "Origin: https://improvingmuslim.com" --data-binary "@-"
```

Expected healthy AI response:

```json
{"results":[{"id":"video:test-money","score":0.95,"reason":"Relevant to money and riba."}]}
```

Expected safe fallback response when the active provider is unavailable:

```json
{"results":[],"fallback":"ai-unavailable"}
```

During initial deployment on July 6, 2026, the Worker deployed correctly and the OpenAI secret was accepted, but OpenAI returned a quota/billing error because ChatGPT Plus billing does not include API usage. The active provider was then moved to DeepSeek because the project already has an active DeepSeek API account and DeepSeek is cheaper for this reranking use case. The Worker converts quota/billing/balance errors into the safe fallback above and caches the unavailable state briefly, so production search remains usable. If AI search appears inactive, check the active provider's API balance/quota before changing frontend code.

### Editing AI Search

- Frontend search UX and fallback behavior: `scripts/home-search.js` and `scripts/script.js`.
- Worker provider selection, prompt/schema/CORS/fallback behavior: `workers/ai-search-worker.js`.
- Endpoint URL and homepage metadata: `scripts/home-config.js`.
- Deployment name, Worker vars, and required secrets: `wrangler.jsonc`.
- Search analytics storage: signed-in submissions create `searchEvents/{eventId}` in Firestore; clients cannot read those events directly.

The current AI feature is a lightweight reranker: the browser sends the current catalog metadata to the Worker, the Worker asks the active provider for JSON-ranked IDs, and the homepage combines those scores with deterministic local relevance tiers. Longer term, the stronger semantic-search upgrade is embeddings/vector search over titles, descriptions, recaps, captions, speakers, and topics, with the reranker used only for final ordering or explanations.

## Video Hosting Pattern

R2 bucket: `islamic-lectures-videos`

Custom domain (CDN-backed, no rate limiting):

```
https://videos.improvingmuslim.com
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
videoSrc: "https://videos.improvingmuslim.com/change-of-heart/change-of-heart-ep-1.mp4"

// Standalone lecture
videoSrc: "https://videos.improvingmuslim.com/belal-assaad/stand-alone/qadr-sabr.mp4"
```

New series should follow the folder/object pattern:

```
series-slug/series-slug-ep-1.mp4
series-slug/series-slug-ep-2.mp4
```

Do not commit real video files to the repository. The `assets/videos/` folders only contain `.gitkeep` files to preserve the intended local structure.

## Uploading Large Videos To R2

Cloudflare's dashboard uploader has a 300 MB limit. Use the S3-compatible API for larger files.

Most uploaded videos are already web-streamable. If a video plays locally and the public URL starts promptly in the browser, you can upload it as-is. If the player stalls on "Loading video..." after upload, or you are unsure about the file's streaming layout, use the ffmpeg remux step below before re-uploading.

Configure AWS CLI with an R2 profile:

```powershell
aws configure --profile r2
# Default region name: auto
# Default output format: json
```

### Publishing from YouTube: use `scripts/publish.ps1`

For any episode whose source is a YouTube video, prefer `scripts/publish.ps1` over doing the download/fix/upload steps by hand. It runs the full pipeline in one command: `yt-dlp` download → ffmpeg faststart remux → R2 upload → `videoSrc` patched into the series data file.

Requires `yt-dlp`, `ffmpeg`, and the AWS CLI with the `r2` profile (see above) on PATH — install with `winget install yt-dlp.yt-dlp` if missing.

```powershell
# Interactive: prompts for YouTube URL, bucket, and filename
.\scripts\publish.ps1

# Single episode: registry-driven, auto-derives the R2 path and patches the data file
.\scripts\publish.ps1 -Series "why-me" -Episode 10 -Url "https://youtu.be/SGdznSHyJUQ"

# Standalone lecture: uploads {speaker}/stand-alone/{lecture}.mp4, then scaffolds
# the thumbnail, cleaned captions, and a ready-to-fill metadata object stub
.\scripts\publish.ps1 -Standalone -SpeakerSlug "abu-bakr-zoud" `
  -LectureSlug "effect-of-the-quran-in-our-life" -Url "https://youtu.be/5mTqC9nb0SY"

# Series batch: a text file of "slug|episode|url" lines, one per episode
.\scripts\publish.ps1 -BatchFile "episodes.txt"

# Standalone batch: a text file of "speakerSlug|lectureSlug|url" lines
.\scripts\publish.ps1 -Standalone -BatchFile "standalone.txt"

# Scaffold only (video already on R2): re-pull thumbnail/captions + reprint stub
.\scripts\publish.ps1 -Standalone -ScaffoldOnly -SpeakerSlug "..." -LectureSlug "..." -Url "https://..."

# Preview only, no downloads/uploads/file changes
.\scripts\publish.ps1 -Series "why-me" -Episode 10 -Url "https://..." -DryRun
```

For standalone lectures the script now auto-scaffolds the mechanical metadata after upload: it fetches the duration and upload date, downloads the thumbnail (maxresdefault, falling back to hqdefault), downloads and cleans the English captions, and prints a metadata object with `id`, `speakerSlug`, `published`, `duration`, `sourceUrl`, `thumbnailSrc`, `videoSrc`, and `captionsSrc` pre-filled. Only the editorial fields (`speaker`, `categories`, `topic`, `description`, and optional `takeaways`/`recap`) are left as `TODO` for you to complete before pasting the object into `data/standalone-lectures-data.js`. Pass `-NoScaffold` to upload without scaffolding.

**Video quality:** the script downloads the best available **H.264 (avc1)** stream, capped at 1080p — this is a deliberate ceiling, not a limitation of the tool. YouTube serves 1440p/4K only as AV1 (even inside an `.mp4` container), and AV1 playback is unreliable on older iOS/Safari and some Android WebViews. Since this site plays video natively with no transcoding step, 1080p H.264 is the highest resolution that's guaranteed to play across every target device. Before publishing a series you want in higher quality, check what's actually available with `yt-dlp -F "<url>"` — older/re-encoded YouTube uploads may only offer 144p-480p regardless of the codec cap.

**Local disk:** downloaded files live under `tmp/yt-dlp/` (gitignored) and are deleted automatically once the R2 upload is confirmed, so the cache doesn't grow unbounded. Pass `-KeepLocal` to keep the file for spot-checking.

**After publishing a series episode**, still do the two things the script doesn't automate:
1. Bump `availableCount` in `data/series-registry.js` for that series.
2. Bump the `?v=` cache-bust on that series' `dataFile` entry in the registry.

Then regenerate canonical routes and run the checks:

```powershell
npm run seo-pages
npm run sitemap
npm run check
```

**After publishing a standalone lecture**, the script has already downloaded the thumbnail, downloaded and cleaned the captions, and printed a metadata stub. Fill the stub's `TODO` editorial fields (`speaker`, `categories`, `topic`, `description`, and — once the transcript is reviewed — `takeaways`/`recap`), paste the object into `data/standalone-lectures-data.js` before the closing `];`, then run the same generation and check commands above. The editorial fields still require human judgment; the mechanical fields no longer do.

### Manual upload (non-YouTube sources, or when the script doesn't apply)

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

### Fix a video that stalls before playing (moov atom)

**Symptom:** Video uploads successfully and the URL is correct, but the player shows "Loading video..." and never starts playing. Other videos may work fine. The stall detector can fire an email report after 20 seconds.

**Cause:** The MP4 file has its metadata (`moov` atom) at the **end** of the file instead of the beginning. This happens with videos downloaded from certain sites or tools that don't optimise for web streaming. The browser needs the metadata first — without it, it must download the entire file before playing anything.

**Fix:** Run ffmpeg on the affected file, then re-upload the fixed version. This remuxes it (no re-encoding, no quality loss) and moves the metadata to the front:

```powershell
ffmpeg -i "C:\Users\sajid\Downloads\video.mp4" -c copy -movflags faststart "C:\Users\sajid\Downloads\video-fixed.mp4"
```

Then upload the `-fixed.mp4` version to R2.

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

## Standalone Lectures

Standalone lectures are individual videos that don't belong to a series. They live in `data/standalone-lectures-data.js` as a single `window.standaloneLectures` array.

Each standalone lecture object:

```js
{
  id: "unique-slug",               // used in the canonical route and progress key
  title: "Lecture Title",
  speaker: "Speaker Name",
  speakerSlug: "speaker-slug",
  category: "purification",        // matches homepage category filter
  topic: "Topic Display Name",
  typeLabel: "Standalone Video",
  published: "YYYY-MM-DD",
  duration: 2702,                  // seconds
  sourceUrl: "https://youtube.com/watch?v=...",
  thumbnailSrc: "./assets/thumbnail/standalone/{speaker-slug}/{id}.jpg",
  videoSrc: "https://videos.improvingmuslim.com/{speaker-slug}/stand-alone/{id}.mp4",
  captionsSrc: "./assets/captions/standalone/{speaker-slug}/{id}.vtt",
  description: "Short description for cards.",
  takeaways: ["..."],
  recap: `Prose recap...`,
}
```

The canonical watch URL for a standalone lecture is `./watch/standalone/{id}/`. The compatibility route `./pages/watch.html?lecture={id}` remains supported. The watch template skips series file loading when the `lecture` parameter is present — `standalone-lectures-data.js` is always pre-loaded on that page.

Thumbnail download: use the YouTube maxresdefault URL and save it locally:

```powershell
Invoke-WebRequest -Uri "https://img.youtube.com/vi/{videoId}/maxresdefault.jpg" `
  -OutFile "assets\thumbnail\standalone\{speaker-slug}\{id}.jpg"
```

Check whether the source offers captions with `yt-dlp --list-subs "{youtube-url}"`. When only YouTube's English automatic track is available, download it as WebVTT and rename the generated `.en-orig.vtt` file to the catalog path:

```powershell
yt-dlp --skip-download --write-auto-subs --sub-langs en-orig --sub-format vtt `
  -o "assets\captions\standalone\{speaker-slug}\{id}.%(ext)s" "{youtube-url}"

Move-Item "assets\captions\standalone\{speaker-slug}\{id}.en-orig.vtt" `
  "assets\captions\standalone\{speaker-slug}\{id}.vtt"
```

**Always run `npm run clean-vtt` after downloading any YouTube auto-captions.** YouTube's auto-caption VTTs pin every cue to the far left with settings like `align:start position:0%` on the timing line. The browser's native `<track>` renderer honours those settings, so the captions render hard against the left edge instead of bottom-centre — very visible on iPhone. `scripts/clean-vtt.js` strips those per-cue positioning settings (leaving the text untouched) so captions fall back to the default bottom-centre placement. It is idempotent and safe to run on the whole `assets/captions` tree. `npm run check` now includes `check:vtt`, which fails if any committed VTT still carries positioning settings — so this can't silently regress.

Automatic captions are useful as an accessibility fallback, but they are not a reviewed transcript. Spot-check timing and wording, and prioritize human correction of Quran quotations, Arabic terms, names, and theological statements.

## Episode Publishing Workflow

When adding a new watchable episode from a YouTube source, steps 1-4 below are handled by `scripts/publish.ps1` (see the Uploading Large Videos To R2 section) — run that first, then pick up from step 5.

1. Run ffmpeg faststart on the video file (see above). *(automated by `publish.ps1`)*
2. Upload the MP4 to Cloudflare R2 using the naming pattern above. *(automated by `publish.ps1`)*
3. Confirm the public URL (`https://videos.improvingmuslim.com/...`) plays in a browser tab.
4. Update the matching episode object in the relevant `data/*-data.js` file with `videoSrc`. *(automated by `publish.ps1`)*
5. If a transcript is available, generate a VTT file under `assets/captions/{series-slug}/`.
6. Add `captionsSrc` to the episode object.
7. For Islamic lecture series: add `takeaways` and `recap` when the transcript has been reviewed.
8. For language course series (e.g. Madina Arabic): add `grammarNotes` and `recap` — skip `takeaways`. See the Language Course Episodes section below.
9. Keep `episode.id` unchanged — progress is keyed to the YouTube video ID, not the R2 URL.
10. Make sure the local episode thumbnail exists as `assets/thumbnail/{series-slug}/episodes/episode-XX.jpg`.
11. Bump `availableCount` and the `dataFile` cache-bust for that series in `data/series-registry.js`.
12. Run `npm run seo-pages` and `npm run sitemap` to update committed generated routes.
13. Run `npm run check` and test locally.

When an episode is not uploaded yet: omit `videoSrc`, keep `statusNote`. The series page and watch sidebar show it as `Uploading soon`.

## Adding A New Series

Everything derives from `data/series-registry.js`. The homepage, browse page, explore page, roadmap, watch-page loader, speaker pages, history/saved pages, sitemap, and syntax checks all read the registry — none of them are edited by hand.

To add a series:

1. Create `data/{series-slug}-data.js` with the episode list (copy an existing data file as a template). Only add `videoSrc` for episodes actually uploaded to R2.
2. Add one entry to `data/series-registry.js` (slug, dataFile, categories, sectionTitle, title, speaker, thumbnailSrc, description, episodeThumbnailPath, playlistId, episodeCount, availableCount). Optional roadmap fields: `roadmapStatus: "scheduled"` plus `roadmapTarget: "Fully uploaded by ..."` — otherwise the roadmap derives Uploading/Planned from `availableCount`.
3. Add assets: `assets/thumbnail/{series-slug}/...` and, if the speaker is new, `data/speaker-data.js` plus a photo in `assets/speaker/`.
4. Run `npm run seo-pages` to generate the canonical series page and any watchable episode routes.
5. Run `npm run sitemap` to regenerate `sitemap.xml` from the registry.
6. Run `npm run check` and verify: homepage card, browse page, canonical series page, canonical watch page, and roadmap.

## Removing A Series

1. Delete the registry entry in `data/series-registry.js` and delete `data/{series-slug}-data.js`.
2. Delete `assets/thumbnail/{series-slug}/` and any captions under `assets/captions/{series-slug}/`.
3. Run `npm run seo-pages` and `npm run sitemap`, then `npm run check`.
4. If the series still appears in the remote `series-api` feed with an external link, add its exact title (lowercased) to `excludedSeriesTitles` in `scripts/home-config.js`. Cards pointing at unregistered series IDs are dropped automatically.
5. Compatibility URLs are guarded automatically: `series-detail.html?id=...` redirects to the browse page and `watch.html?series=...` redirects home for unregistered slugs.
6. If episodes were uploaded to R2, delete the objects from the `islamic-lectures-videos` bucket so direct video URLs stop working.

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

## Generated And Compatibility Routes

The canonical public routes are:

```text
/series/{series-slug}/
/watch/{series-slug}/{episode-id}/
/watch/standalone/{lecture-id}/
```

`scripts/generate-seo-pages.js` creates those routes from `pages/series-detail.html`, `pages/watch.html`, the registry, and the episode data. The generated HTML is committed so GitHub Pages can serve useful metadata without server-side rendering. Edit the templates or data, never files inside `series/` or `watch/`, then run:

```bash
npm run catalog
npm run seo-pages
npm run sitemap
```

(`npm run catalog` regenerates `data/catalog-data.js`, the related-lectures index — run it whenever episode data, standalone lectures, or captions change.)

The older query-string pages remain compatibility fallbacks for existing links.

## Watch Page Dynamic Series Loading

`pages/watch.html` loads only the data file needed for the current `?series=` parameter. The inline loader looks the slug up in `window.seriesConfig` and injects that entry's `dataFile`. The history, saved, and speaker pages use a similar loader that injects every registered `dataFile`. No page lists data files by hand.

To cache-bust a data file after publishing episodes, append or update a version query in the registry's `dataFile` field (e.g. `"./data/change-of-heart-data.js?v=YYYYMMDD-note"`) — every page picks it up from there.

## Script Cache Busting

Script tags use query string versioning to force browsers to fetch updated files:

```html
<script src="./scripts/watch-page.js?v=20260607-stall-detection" defer></script>
```

Update the version string on any script tag whenever its corresponding file changes and those changes need to reach users who have previously visited the page. The format is `YYYYMMDD-brief-description`. This applies to `watch-page.js`, `series-page.js`, `utils.js`, `firebase-auth.js`, and data-file URLs in `data/series-registry.js`. If a maintained template changes, regenerate the canonical routes afterward.

## Watch Progress and Cloud Sync

Watch progress is saved in browser `localStorage` by `scripts/watch-page.js`.

Storage key format:

```js
lecture-progress:${series.playlistId}:${episode.id}  // series episode
lecture-progress:standalone:${lecture.id}             // standalone lecture
```

Progress is tied to the stable YouTube video ID, not the R2 file URL. An R2 file can be replaced without resetting progress.

**Cloud sync (Firebase):** When a user is signed in, `scripts/firebase-auth.js` automatically syncs `localStorage` to Firestore in real time. Progress and saved items are merged across devices — the entry with the newest `updatedAt` timestamp wins per key. Signing in on a new device pulls all previous progress immediately. See the Firebase Authentication section below.

Important implications for localStorage-only (guest) users:

- Keep `episode.id` stable once published.
- Changing origin (e.g. from `github.io` to `improvingmuslim.com`) creates a new browser origin, so old progress does not carry over.
- Clearing browser data removes all saved progress.

The Settings page at `pages/settings.html` explains local storage and lets users reset watch history and saved items on the current device. Theme preference (`improving-muslim:theme`) is also stored in localStorage and is intentionally not synced to the cloud.

## My Notes

Every watch page has a "My Notes" panel (below the video, above Key Takeaways) where learners can write free-form per-episode notes as they watch. Implemented entirely in `scripts/watch-page.js`; the storage/sync plumbing lives in `scripts/utils.js` and `scripts/firebase-auth.js`.

Storage key format mirrors watch progress exactly:

```js
lecture-notes:${series.playlistId}:${episode.id}  // series episode
lecture-notes:standalone:${lecture.id}             // standalone lecture
```

Built via `window.IMUtils.notesKey(series, episode)` / `standaloneNotesKey(lecture)`. Stored value: `{ text, updatedAt }`. Synced to Firestore the same way as progress (newest `updatedAt` wins per key) — see the Firestore data structure below.

**Editor model:** a plain `<textarea>` with a small formatting toolbar (H1/H2/H3/Bold/Italic buttons that insert lightweight markdown at the cursor) plus an Edit/Preview tab toggle, not a live rich-text/contenteditable editor. This keeps the implementation simple and safe (no HTML is ever stored, only markdown-lite text) and avoids the cross-browser fragility of building a WYSIWYG editor from scratch with no external libraries.

**Supported syntax** (rendered only in the Preview tab, via `renderNoteMarkdown` in `watch-page.js`):

```
# / ## / ###   heading levels (rendered as styled text, not real <h1>-<h3> tags,
               so user notes never pollute the page's real heading outline)
**bold**, *italic*
05:00 / 1:05:23   any MM:SS or H:MM:SS token auto-links to a clickable
                  timestamp that seeks the player to that position
```

The "Insert current time" toolbar button inserts the player's live position in the same `MM:SS` format so typed and inserted timestamps always match the auto-linking regex.

Notes autosave ~600ms after the user stops typing, and flush immediately on `visibilitychange` so a note isn't lost if the user navigates away mid-debounce.

## Firebase Authentication

Firebase project: **Improving Muslim** (`improving-muslim`)
Firebase console: `console.firebase.google.com/project/improving-muslim`

### Services in use

| Service | Purpose |
|---|---|
| Firebase Authentication | Google Sign-In only |
| Cloud Firestore | Cloud storage for watch progress, notes, saved items, streaks, and opt-in public leaderboard rows |

### How sync works

`scripts/firebase-auth.js` is loaded on every page. It:

1. Initialises the Firebase app using the project config.
2. Listens for Google auth state changes.
3. On sign-in: pulls the user's Firestore document, merges it with localStorage (newest `updatedAt` wins per progress/notes key; saved items are deduped by key; streak stats are merged), writes the merged result back to both localStorage and Firestore.
4. On every localStorage write: debounces a push to Firestore (3-second delay) so frequent progress saves don't burn write quota.
5. Hands Firebase user/database access to `scripts/streak-ui.js`, which writes only opt-in public display names and streak summaries to `leaderboard/{uid}`. Watch history and saved items are never public.
6. On sign-out: stops syncing; localStorage continues to work as normal.

### Firestore data structure

```
users/{uid}/data/sync  (single document)
  progress: { "lecture-progress:playlistId:episodeId": { currentTime, duration, updatedAt, completed, _card }, ... }
  notes: { "lecture-notes:playlistId:episodeId": { text, updatedAt }, ... }
  saved: [ { key, type, title, subtitle, url, savedAt }, ... ]
  streak: {
    targetMinutes,       // always 30 -- fixed, not user-selectable (see below)
    todayDate,
    todaySeconds,
    current,
    best,
    lastCompletedDate,
    days: { "YYYY-MM-DD": { seconds, completed }, ... },
    freezesAvailable,        // banked streak freezes, 0-2
    freezeMilestonesClaimed, // total 7-day milestones ever granted a freeze for
    publicOptIn,
    publicName,
    updatedAt,
    targetUpdatedAt
  }
  lastSyncedAt: timestamp in milliseconds

leaderboard/{uid}  (public, opt-in only)
  displayName: string
  current: number
  best: number
  targetMinutes: 30
  lastCompletedDate: "YYYY-MM-DD"
  updatedAt: timestamp in milliseconds

searchEvents/{eventId}  (private analytics, signed-in submissions only)
  query: string
  queryLower: string
  resultCount: number
  contentType: "all" | "series" | "videos"
  category: string
  userId: uid
  createdAt: server timestamp
  createdAtMs: timestamp in milliseconds
```

### Firestore security rules

The deployable rules live in `firestore.rules` and are referenced by `firebase.json`.
They enforce:

- `users/{uid}/data/sync` can only be read and written by that signed-in user.
- `leaderboard/{uid}` can be read publicly, but only written or deleted by that same signed-in user.
- Leaderboard rows may only contain safe public fields: `displayName`, `current`, `best`, `targetMinutes`, `lastCompletedDate`, and `updatedAt`.
- Emails, watch history, saved items, and detailed daily heatmap data are not allowed in public leaderboard rows.
- `searchEvents/{eventId}` is create-only for signed-in users and cannot be read, updated, or deleted by clients.
- Admin dashboard reads are limited in Firestore rules to the allowlisted admin email in `isAdmin()`.

Deploy rules after editing them:

```powershell
firebase deploy --only firestore:rules --project improving-muslim
```

### Streak Ranks and Freezes

The daily streak goal is fixed at 30 minutes of actual lecture playback for every user (not user-selectable) so the leaderboard's day counts are directly comparable across everyone. The storage and normalization logic lives in `scripts/utils.js` (`normalizeStreak`, used by `watch-page.js` when recording playback). The streak navigation button, panel, heatmap, and leaderboard UI live in `scripts/streak-ui.js`. `scripts/firebase-auth.js` stays focused on auth/sync and gives `streak-ui.js` access to the current Firebase user and Firestore instance.

**Ranks** (`STREAK_RANKS`, derived from `current`, highest match wins):

| Rank | Minimum current streak |
|---|---|
| Iron | 5 days |
| Bronze | 10 days |
| Silver | 20 days |
| Platinum | 40 days (max rank) |

Shown as a badge next to the streak count in the personal tab, on each leaderboard row (computed client-side from `row.current`, no extra Firestore field needed), and in the Settings page summary.

**Streak freezes** (Duolingo-style leniency): every 7 consecutive days of a streak earns 1 freeze, banked up to a max of 2 (`FREEZE_MILESTONE_DAYS`, `MAX_BANKED_FREEZES`). If a day is missed, `normalizeStreak` silently spends 1 freeze per missed day to bridge the gap and keep the streak alive — no user action needed, it just doesn't reset. If the gap is larger than the available freezes, the streak resets to 0, but any banked freezes are **not** consumed (they carry over to the next streak attempt) since they weren't enough to save it. A full reset also resets `freezeMilestonesClaimed` so the new streak earns milestones from day 1 again.

### Authorised domains

The following domains are whitelisted in Firebase Authentication → Settings → Authorised domains:

- `improvingmuslim.com`
- `sajidmohd717.github.io`
- `localhost`

Add any new domains here if the site is ever served from a different origin.

### What is and isn't synced

| Data | Synced |
|---|---|
| Watch progress | Yes |
| Episode notes | Yes |
| Saved items | Yes |
| Daily streak stats | Yes |
| Public leaderboard row | Optional, opt-in only |
| Theme preference | No — device-local by design |
| Autoplay setting | No — device-local by design |

## Social Preview Image

The OG image shared on WhatsApp, Instagram, and other platforms is `public/social-preview.png` (1200×630px).

The source template is `public/social-preview-template.html`. Regenerate the PNG after any design changes using Chrome headless:

```powershell
$root = (Get-Location).Path
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --window-size=1200,630 `
  --screenshot="$root\public\social-preview.png" `
  "$root\public\social-preview-template.html"
```

After regenerating, commit both the updated template and the new PNG together. Social platforms cache OG images aggressively — use `https://www.opengraph.xyz` to force a fresh fetch and verify the result.

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

Captions produced by `transcript-to-vtt.js` are already centre-aligned. Captions downloaded from YouTube auto-subs are **not** — run `npm run clean-vtt` on them (see the Standalone Lectures caption step above) to strip the left-pinning cue settings before committing.

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

`pages/speakers.html` is the speaker directory; individual profiles live at `pages/speaker.html?speaker={slug}`. There is currently no speaker strip on the homepage.

Speaker ordering is controlled in `data/speaker-data.js`. Prioritize speakers with fully or partially hosted series on the platform.

Speaker photos belong in `assets/speaker/`. Series thumbnails should remain separate from speaker portraits unless a real series image is not available yet.

## Feedback And Error Emails

Every page footer links to `pages/feedback.html`. Feedback form submissions POST to FormSubmit at `contact@improvingmuslim.com`.

`scripts/error-handler.js` uses the same FormSubmit endpoint to silently report production JS crashes. `scripts/watch-page.js` uses the same endpoint to report video stall events. All three share the same confirmed endpoint. FormSubmit may require re-confirmation if the endpoint has been inactive — check the inbox if emails stop arriving.

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

## Scaling Guardrails And Recommended Next Work

The static architecture is still a good fit for the current product: it is inexpensive to host, resilient when optional services fail, and easy to deploy. The main scaling risk is now authoring duplication and catalog drift rather than browser performance.

Prioritize these improvements before the catalog and contributor count grow substantially:

1. **Add a catalog integrity validator.** It should verify unique slugs and episode IDs, `episodeCount` and `availableCount`, required metadata, local thumbnail/caption paths, R2 URL shape, and permission status. Make it part of `npm run check`. This removes the most likely class of publishing mistakes.
2. **Generate the shared page shell.** Headers, navigation, footers, Firebase script order, and cache-bust strings are duplicated across many HTML templates. Introduce a small repository-owned generator or include system that still emits plain static HTML; do not add a client framework merely to solve authoring duplication.
3. **Split the largest controllers by feature boundary.** As `scripts/script.js` and `scripts/watch-page.js` grow, extract search orchestration, catalog rendering, progress, notes, and player recovery into testable modules with explicit interfaces. Preserve the current global APIs temporarily for compatibility.
4. **Add focused data and behavior tests.** Unit-test catalog merging, progress/streak normalization, Firebase merge behavior, route helpers, and search ranking. Keep Playwright for a few critical end-to-end journeys instead of making every edge case a browser test.
5. **Automate content-health checks separately from pull-request CI.** A scheduled or manually triggered job can check external R2 media, caption URLs, remote-feed availability, and broken outbound links without making ordinary development depend on network stability.

Defer a service worker until there is an explicit offline/cache invalidation policy. Videos should remain network-only; an eventual PWA should cache only the app shell and safe static assets.

## Local Development

Install Node.js 20+, Python 3, and dependencies first:

```bash
npm install
npx playwright install chromium
```

```bash
npm run dev
```

This runs `python -m http.server 4173`. Open `http://localhost:4173/`.

Run checks before pushing:

```bash
npm run check
```

`npm run check` runs the JavaScript, accessibility, generated SEO page, sitemap, and Playwright browser smoke checks. The smoke suite uses `playwright.config.js`, `tests/smoke.spec.js`, and the dependency-free local server in `scripts/test-server.js`.

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
