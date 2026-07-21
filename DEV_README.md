# Improving Muslim Developer Guide

This project is intentionally a plain HTML, CSS, and JavaScript site. It does not use React. Do not introduce a client framework or application bundler unless the project direction explicitly changes. Small authoring-time generators and validation scripts are part of the current architecture, but production remains deployable as static files.

This document is a living guide. The architecture, hosting choices, and workflow are expected to evolve as the platform grows. Treat these notes as current project context, not a rigid rulebook, except for the mandatory Git policy below. Update this file whenever the actual workflow changes.

> [!IMPORTANT]
> **All changes go directly to `main`.** Before editing, switch to `main` and synchronize it with `origin/main`. Never create a local or remote feature branch, draft branch, or pull request for this repository. This rule applies to developers, automation, and coding agents, and overrides any generic contribution or publishing workflow that defaults to branches or pull requests. Commit and push completed work directly to `origin/main`.

For the short, repeatable checklist used whenever a video or series episode is added, changed, or removed, start with [CONTENT_OPERATIONS.md](./CONTENT_OPERATIONS.md). This guide remains the detailed reference; the operations checklist is the release procedure.

## Project Shape

- `index.html` stays at the repository root because GitHub Pages serves it as the entry point.
- `pages/` contains maintained secondary page templates and query-string compatibility routes such as series detail, watch, speaker profiles, settings, and about.
- `scripts/page-shell.js` is the single source of truth for shared head assets, public/admin headers, footers, mobile bottom navigation, common script order, and their cache versions. Edit the shell there, then run `npm run page-shell`; do not hand-edit the generated regions between `page-shell:*` comments.
- `scripts/generate-page-shell.js` writes those regions into `index.html` and the maintained files in `pages/`. Its `--check` mode is part of CI. `404.html` intentionally remains a minimal standalone emergency page.
- `series/` and `watch/` contain canonical, crawlable pages generated from the maintained templates and catalog data by `scripts/generate-seo-pages.js`. Never edit generated pages by hand.
- `scripts/` contains browser logic and utility scripts.
- `data/` contains series and speaker data files.
- `styles/styles.css` is the CSS entry point — it only `@import`s focused sub-files from `styles/`. Do not add rules directly to `styles.css`; add them to the appropriate sub-file and bump that import's `?v=` version.
- `data/category-taxonomy.js` is the single source of truth for public topic names, descriptions, aliases, ordering, and homepage system filters. Both the homepage and Explore derive their category UI from it.
- `scripts/home-config.js` holds homepage service endpoints, curated descriptions, remote-feed exclusions, and the `catalogVersion` cache key. Bump `catalogVersion` whenever the remote catalog JSON changes.
- `scripts/script.js` is the homepage controller: page state, the main results grid, search result rendering, and event wiring. Keep static homepage metadata in `home-config.js` when possible so this controller stays focused on behavior.
- `scripts/home-data.js` (`window.IMHomeData`) assembles homepage catalogue data: the category name map, local series/standalone card sections, remote-feed normalization and merging, the remote-card allow-list filter, and the offline fallback sections. No DOM.
- `scripts/home-feed.js` (`window.IMHomeFeed`) owns grid ordering: the stable per-session shuffle, the explicit sort modes, the balanced discovery mix, and the watch-history-seeded personalized blend built on the catalog + `IMRelated` ranking. No DOM.
- `scripts/home-shelves.js` (`window.IMHomeShelves`) renders the homepage shelves outside the main grid: Continue learning, Popular right now, the daily streak card, and the speaker rail.
- `scripts/home-card-actions.js` (`window.IMCardActions`) implements the grid cards' save/share actions and card-menu open/close bookkeeping; `script.js` owns the event delegation.
- `scripts/home-search.js` owns homepage search behavior: suggestions while typing, submit-only search, result matching, and the search-mode handoff back to `script.js`.
- `pages/speakers.html` is the full speaker directory, linked from the bottom navigation.
- `scripts/series-page.js` renders dedicated series episode lists.
- `pages/watch.html` is the focused video player page — handles both series episodes (`?series=&video=`) and standalone lectures (`?lecture=`).
- `scripts/watch-page.js` is the watch-page controller: it resolves the selected episode or standalone lecture and wires native playback, progress saving, resume, completion state, study-time tracking, media-session controls, autoplay-next, and keyboard seeking.
- `scripts/watch-notes.js` (`window.IMWatchNotes`) is the per-episode "My Notes" panel — markdown-lite editing, preview with clickable timestamps, debounced autosave. See the My Notes section below.
- `scripts/watch-stall.js` (`window.IMWatchStall`) diagnoses video stalls and errors, auto-retries, shows the user-facing failure message, and reports investigable causes to the contact inbox.
- `scripts/watch-sidebar.js` (`window.IMWatchSidebar`) renders the watch sidebar: the "Up next" card, the compact episode list, the mobile collapse behavior, and the related lectures ranked by `IMRelated`.
- `data/series-registry.js` is the central series registry — the single source of truth for all series slugs, categories, and global keys.
- `data/*-data.js` files are the series data sources.
- `data/standalone-lectures-data.js` holds all standalone (non-series) lecture objects in a single `window.standaloneLectures` array.
- `data/speaker-data.js` controls speaker ordering and profile metadata.
- `data/catalog-data.js` is a generated flat index of every watchable episode and standalone lecture, each with normalized metadata and a TF-IDF term vector (built from titles, descriptions, keywords, takeaways, recaps, and caption transcripts). Never edit by hand — regenerate with `npm run catalog` after any content change, and CI verifies it with `npm run check:catalog`.
- `scripts/generate-catalog.js` builds `data/catalog-data.js` from the registry, series data files, standalone lectures, and `assets/captions/`.
- `scripts/related-videos.js` is the pure ranking module (`window.IMRelated.rankRelated`) behind the watch page's "Related lectures" sidebar: term-vector cosine similarity, category overlap, same-speaker and recency boosts, watched demotion, and per-series/per-speaker diversity caps. Loaded on the watch template before `watch-page.js`, which renders the results (and, for standalone lectures, uses the top result as the "Up next" card and autoplay-next target).
- The homepage's main **For you** grid reuses the catalog + `IMRelated` ranking. Up to three recent meaningfully-watched lectures (completed, or 2+ minutes in) seed a blended order: two relevant cards followed by one discovery card. Started-but-unfinished standalone lectures stay in Continue learning instead of being duplicated in the recommendation pool. New visitors retain the fresh discovery shuffle, while Featured order, category, search, and explicit sort choices remain deterministic overrides. There is intentionally no separate "Because you watched" shelf.
- `data/transcript-index-data.js` is a generated token → lecture index over every caption transcript. Never edit by hand — regenerate with `npm run transcript-index` whenever captions or lecture data change; CI verifies it with `npm run check:transcript-index`. Transcript text is never duplicated into the index.
- `scripts/generate-transcript-index.js` builds that index from the registry, data files, and `assets/captions/`.
- `scripts/popularity.js`, `workers/popularity-worker.js`, and `wrangler.popularity.jsonc` implement the anonymous popularity counters ("Popular right now" shelf, play counts, ranking prior). See the Popularity Signals section below.
- `scripts/transcript-search.js` powers the homepage's "Mentioned inside lectures" search section: it lazy-loads the transcript index on first search, picks candidate lectures from the postings, fetches only those lectures' VTT files, and returns timestamped snippets. Each result links to the watch page with a `?t=` parameter, which `watch-page.js` honours on load (a `?t=` seek wins over the saved resume position). Query tokenization/stemming/synonyms are shared with `home-search.js` via `window.IMHomeSearch.queryTokens`/`tokenVariants`.
- `scripts/firebase-auth.js` handles Google sign-in, Firestore sync, and exposes `window.IMAuth`. Loaded on all pages. See the Firebase Authentication section below.
- `scripts/streak-ui.js` handles the nav streak button, streak panel, monthly heatmap, and public leaderboard UI. It loads after `utils.js` and before `firebase-auth.js`.
- `pages/admin.html` is a direct-link private admin dashboard. It currently reads submitted search analytics for allowlisted admin emails only.
- `assets/captions/` contains WebVTT captions, grouped by series slug or `standalone/{speaker-slug}/`.
- `assets/thumbnail/standalone/{speaker-slug}/` holds standalone lecture thumbnails.
- `scripts/transcript-to-vtt.js` converts pasted YouTube-style transcripts into WebVTT cues.
- `scripts/publish.ps1` is the YouTube-to-R2 publisher (download, faststart fix, upload, and series data patching; standalone metadata remains editorial). See the Uploading Large Videos To R2 section below.
- `scripts/check-a11y.js` scans every static HTML page for common accessibility issues.
- `scripts/generate-seo-pages.js` and `scripts/generate-sitemap.js` generate canonical content routes and `sitemap.xml`; their `--check` modes keep committed output current. Canonical pages inherit the shared shell from `pages/series-detail.html` and `pages/watch.html`, while their generated heads reuse the asset source from `scripts/page-shell.js`.
- `scripts/error-handler.js` catches unhandled JS errors and promise rejections, shows a friendly fallback UI, and silently reports crashes to `contact@improvingmuslim.com` via FormSubmit. It is currently loaded on the heavy interactive pages (index, history, saved, watch) — load it first, before all other scripts, on any page that includes it.
- `scripts/nav-state.js` tracks the last visited series URL for the "Series" nav link, and injects the mobile back button on all inner pages.
- `pages/explore.html` is the compact topic directory. Its cards link to focused category routes instead of filtering the personalized homepage.
- `pages/category.html?category={slug}` is the dedicated topic library. `scripts/category-page.js` renders its deterministic series and standalone-lecture sections directly from the shared taxonomy and maintained content data; it intentionally has no continue-learning, streak, or recommendation shelves.
- `scripts/explore-page.js` drives the Explore directory counts and card rendering. `styles/explore.css` contains both Explore-directory and focused-category styles.
- `assets/thumbnail/` and `assets/speaker/` contain local image assets.
- `public/` contains brand-facing assets: logo/favicons, the web manifest, and the social sharing preview image.
- `public/social-preview-template.html` is the source template for regenerating `public/social-preview.png`. See the Social Preview Image section below.
- `.github/workflows/check.yml` runs the complete validation suite automatically on every push and pull request to `main`.
- `CNAME` pins the GitHub Pages custom domain to `improvingmuslim.com`.

All pages in `pages/` include a `<base href="../" />` tag. Keep all project links in the form `./pages/...`, `./scripts/...`, `./data/...`, `./assets/...`, and `./styles/...` so links resolve correctly from both `index.html` and inner pages.

Explore category counts have explicit meanings: registered series are counted from `seriesConfig`, currently watchable series episodes are the sum of matching registry `availableCount` values, standalone lectures are matching records with a real `videoSrc`, and total watchable content is available episodes plus standalone lectures. A category is browseable only when that total is greater than zero. The Explore card shows only the total watchable lecture count; the focused category page separates series from individual lectures and gives the detailed context.

## Current Content State

Snapshot as of 21 July 2026: the catalog has 15 series and 27 standalone lectures. One hundred and eleven series episodes and all 27 standalone lectures are currently watchable, for 138 hosted lectures in total. Treat `data/series-registry.js` and the episode data files as authoritative; this table is a human-readable snapshot and should be updated when upload milestones change.

### Series

| Series | Speaker | Category | Watchable |
|---|---|---|---|
| Enjoy Your Prayer | Ali Hammuda | Prayer | 8 / 21 |
| Fortress of the Muslim | Assim Al-Hakeem | Dhikr | 5 / 13 |
| Seerah of the Prophet (S) | Yasir Qadhi | Seerah | 5 / 104 |
| 40 Hadith of Imam Nawawi | Navaid Aziz | Hadith, Righteous Predecessors | 8 / 46 |
| Tafsir Surah al-Kahf | Navaid Aziz | Quran, Tafsir | 6 / 12 |
| The Four Imams: Their Lives and Fiqh Principles | Navaid Aziz | Fiqh, Righteous Predecessors | 3 / 9 |
| Fiqh of Social Media | Navaid Aziz | Fiqh | 3 / 7 |
| Change of Heart | Ali Hammuda | Purification | 10 / 16 |
| Why Me? | Omar Suleiman | Purification | 13 / 30 |
| Angels in Your Presence | Omar Suleiman | Angels | 11 / 30 |
| Life of Muhammad (PBUH) | Mufti Menk | Seerah | 24 / 30 |
| Stories of the Prophets | Mufti Menk | Prophets | 4 / 29 |
| 10 Promised Jannah | AbdulRahman Hassan | Sahaba, Righteous Predecessors | 5 / 10 |
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
| Are you Worried about things? Watch this! | Majed Mahmoud | Purification | Uploaded |
| 17 Lessons From The Story of Musa & Khidr (AS) | Abu Taymiyyah | Quran, Prophets | Uploaded |
| The Surah That Beautifies Your Character | Abu Taymiyyah | Quran, Purification | Uploaded |
| The Path to Prestige and Respect | Belal Assaad | Purification | Uploaded |
| How Shaytaan Plans to DESTROY You | Abu Bakr Zoud | Purification, Aqeedah | Uploaded |
| The 7 Commandments To A Successful Marriage | Abu Taymiyyah | Purification, Fiqh | Uploaded |
| Approaching The Qur'an: The Mind, The Soul & The Limbs | Sheikh Jamal Abdinasir | Quran | Uploaded |


Episodes without an uploaded R2 MP4 should not have a `videoSrc`. The UI automatically shows them as `Uploading soon`. Do not add placeholder local paths.

```js
statusNote: "Video not added yet. It will be uploaded in the future, insha'Allah."
```

**Home feed design decision (July 2026):** the main grid is deliberately a flat, shuffled, mixed-topic feed — the YouTube-style "you never know what's next" browse is the product intent. Labelled topic sections with pinned curated ordering were tried on desktop and reverted (commit `56426d5`) because they made the feed predictable and library-like. Do not reintroduce category headings, grouping, or deterministic default ordering into the home grid on any viewport. Structured browsing already has dedicated surfaces: the category chips, the Explore directory, focused category pages, and the "Featured order" sort option.

The homepage feed defaults to a fresh discovery shuffle for new visitors. Once someone meaningfully watches a lecture, the same grid becomes a personalized **For you** blend driven by semantic similarity, category and speaker affinity, recency, popularity, completion state, and diversity caps. It deliberately interleaves two relevant cards with one discovery card so no topic or speaker can trap the learner in a narrow loop. The order stays stable for that page session so loading another batch never moves cards already seen. The catalog renders 36 cards initially on desktop and 18 at mobile widths, then exposes an accessible `Load more` control in equal-sized batches. Search, category, content-type, sort, and hide-watched changes reset to the first batch. New series and standalone lectures join automatically after the normal content generation step. The curated registry order remains available as the "Featured order" sort option, and the continue-watching hero always renders above the feed for returning users. Series should still be assigned to the topic that best matches the learner's intent, not merely the speaker or source playlist.

## Git Workflow

Work directly on `main`. Do not create local or remote feature branches, draft branches, or pull requests for development, content publishing, or automated changes. Generic tool and plugin defaults do not override this repository policy. After reviewing the intended diff and running the required checks, commit the changes on `main`, fetch `origin`, confirm the push will be a fast-forward, and push directly with `git push origin main`.

## CI / Automated Checks

Every push and pull request to `main` triggers `.github/workflows/check.yml`, which runs on a clean Ubuntu environment:

1. `npm run check:js` — syntax check of every file in `scripts/` and `data/` (auto-discovered, no list to maintain).
2. `npm run check:content` — validates maintained catalog identity, metadata, speakers, media URL shapes, local assets, registry counts, generated catalog membership, canonical pages, and sitemap coverage.
3. `npm run check:taxonomy` — verifies taxonomy structure, homepage coverage, and every category used by maintained series and standalone lectures.
4. `npm run check:a11y` — custom accessibility audit of the maintained HTML page templates.
5. `npm run check:seo-pages` — fails if any generated series or watch route is stale.
6. `npm run check:sitemap` — fails if sitemap.xml is out of date with the series registry (fix with `npm run sitemap`).
7. `npm run check:vtt` — fails if any committed WebVTT caption still carries left-pinning positioning cue settings (fix with `npm run clean-vtt`).
8. `npm run check:smoke` — Playwright coverage for homepage rendering, search/filtering, a synthetic 500-video catalog, shared Explore taxonomy, generated series-to-watch navigation, streak-target migration, runtime errors, and the 390px keyboard-accessible menu and catalog batch.

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

**Video stall detection** lives in `scripts/watch-stall.js`. If a video has buffered zero data after 20 seconds, it shows a friendly error message with a user-controlled Retry button and silently fires the same FormSubmit report with the exact `videoSrc` URL. Never silently call `player.load()` to recover: doing so can cancel a play request or saved-position seek. The custom loading pill is only for the initial metadata request; resume-seek and mid-playback buffering use the browser's native player feedback.

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

## Popularity Signals

Anonymous, aggregate-only play/completion counters per lecture — no user ids, no IPs stored. They power the homepage "Popular right now" shelf, the play-count labels on it, and a mild log-scaled popularity prior inside `IMRelated.rankRelated`.

| Piece | Location |
|---|---|
| Worker (POST /event, GET /popular, GET /health) | `workers/popularity-worker.js` |
| Wrangler config | `wrangler.popularity.jsonc` |
| Browser client (beacons + cached counts) | `scripts/popularity.js` |
| Play/complete beacons | `scripts/watch-page.js` |
| "Popular right now" shelf | `renderPopularShelf` in `scripts/script.js` |

The frontend degrades silently until the Worker is deployed: no errors, no shelf, no ranking boost. Wrangler provisions the declared `POPULARITY` KV namespace automatically on the first deployment, so no account-specific namespace ID belongs in the repository. To deploy:

```powershell
npx wrangler deploy -c wrangler.popularity.jsonc
```

To test the live Worker:

```powershell
curl.exe -sS "https://improving-muslim-popularity.improving-muslim.workers.dev/health" -H "Origin: https://improvingmuslim.com"
'{"key":"video:qadr-and-sabr","event":"play"}' | curl.exe -sS -i -X POST "https://improving-muslim-popularity.improving-muslim.workers.dev/event" -H "Content-Type: application/json" -H "Origin: https://improvingmuslim.com" --data-binary "@-"
curl.exe -sS "https://improving-muslim-popularity.improving-muslim.workers.dev/popular" -H "Origin: https://improvingmuslim.com"
```

Behavioral notes: the browser sends at most one play and one complete per lecture per device per day (localStorage dedupe); the browser caches `GET /popular` in localStorage for 30 minutes; the shelf only appears once at least four lectures have 2+ plays. The response includes a 15-minute cache hint for a future custom-domain deployment, but the Cache API is deliberately not used because it is unavailable on `*.workers.dev`. KV increments are read-modify-write, so rare concurrent plays can lose a count — acceptable for a best-effort signal. The Worker endpoint URL is a constant at the top of `scripts/popularity.js`.

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

**Video quality:** the script downloads the best available **H.264 (avc1)** stream using a duration-based ceiling: videos longer than 20 minutes use 720p, while videos up to and including 20 minutes use 1080p. Long lectures therefore use substantially less R2 storage and viewer bandwidth, while short videos retain the extra detail of 1080p. Pass `-MaxHeight 720` or `-MaxHeight 1080` to override the automatic choice when small on-screen text or another source-specific reason warrants it.

H.264 remains mandatory for broad playback compatibility. YouTube commonly serves 1440p/4K as AV1 even inside an `.mp4` container, and AV1 playback is unreliable on older iOS/Safari and some Android WebViews. Since this site plays video natively with no transcoding step, the publisher deliberately avoids those higher-resolution AV1 streams. Check the available source formats with `yt-dlp -F "<url>"` when quality is uncertain; older or re-encoded uploads may only offer 144p–480p regardless of the selected ceiling.

#### Troubleshooting slow YouTube downloads without lowering quality

At 720p and 1080p, YouTube normally exposes separate DASH video-only and
audio-only streams. This is expected: `yt-dlp` downloads both and ffmpeg merges
them into one ordinary MP4 before upload. A combined audio/video format is often
available only at 360p, so do not select that format merely to avoid the merge.
Keep the normal 720p ceiling for long lectures, or 1080p for eligible short
videos, unless the source itself has no compatible stream at that resolution.

On an unusually slow or constrained local connection, YouTube's CDN can
throttle one DASH track while the other remains reasonably fast. This is a
recovery path for that occasional environment-specific problem, not part of the
normal publishing workflow. Downloads under `tmp/yt-dlp/` are resumable, so
preserve the `.part` files and try these remedies in order:

1. Stop and rerun the same `publish.ps1` command. `yt-dlp` resumes the saved
   bytes and obtains a fresh signed CDN URL; this frequently clears a throttled
   long-lived connection without starting over.
2. Try `curl` as the external downloader. It still retrieves the exact formats
   selected by `yt-dlp` and keeps the same resumable output names:

   ```powershell
   yt-dlp -f "bestvideo[vcodec^=avc1][ext=mp4][height<=720]+bestaudio[ext=m4a]" `
     --downloader curl `
     --downloader-args "curl:-L --retry 20 --retry-all-errors --connect-timeout 20" `
     --merge-output-format mp4 --no-playlist -o "tmp/yt-dlp/example-raw.mp4" `
     "https://www.youtube.com/watch?v=VIDEO_ID"
   ```
3. If `aria2c` is installed, use it for parallel ranged requests. This is most
   useful when one audio stream settles at a very low single-connection rate:

   ```powershell
   yt-dlp -f "bestvideo[vcodec^=avc1][ext=mp4][height<=720]+bestaudio[ext=m4a]" `
     --downloader aria2c `
     --downloader-args "aria2c:-x 16 -s 16 -k 1M --file-allocation=none" `
     --merge-output-format mp4 --no-playlist -o "tmp/yt-dlp/example-raw.mp4" `
     "https://www.youtube.com/watch?v=VIDEO_ID"
   ```

   Once aria2 has created a matching `.aria2` control file, keep resuming that
   component with aria2 until it completes. Its ranged download can make the
   `.part` file appear full-sized while gaps are still pending; switching that
   incomplete file back to curl or the native downloader can produce a corrupt
   MP4. If downloader provenance is uncertain, isolate the partial component
   and download that component cleanly from byte zero.
4. If the route remains slow, resume over a trusted VPN, Cloudflare WARP, or a
   different connection. For a large batch, a temporary VM can run the same
   publisher and upload directly to R2, but use a short-lived bucket-scoped R2
   credential and remove it afterward. Some datacenter IPs are blocked by
   YouTube, so test one episode before moving a whole batch.

After changing downloaders or recovering interrupted ranged downloads, decode
the merged file once before publishing. A successful run produces no output and
exits with code 0:

```powershell
ffmpeg -v error -xerror -i "tmp/yt-dlp/example-raw.mp4" `
  -map 0:v:0 -map 0:a:0 -f null NUL
```

Do not commit temporary downloads, signed Googlevideo URLs, cookies, or R2
credentials. Avoid 360p progressive formats as a speed workaround when the
source provides the required 720p or 1080p H.264 stream.

**Local disk:** downloaded files live under `tmp/yt-dlp/` (gitignored) and are deleted automatically once the R2 upload is confirmed, so the cache doesn't grow unbounded. Pass `-KeepLocal` to keep the file for spot-checking.

**After publishing a series episode**, still do the two things the script doesn't automate:
1. Bump `availableCount` in `data/series-registry.js` for that series.
2. Bump the `?v=` cache-bust on that series' `dataFile` entry in the registry.

Then regenerate every derived content artifact and run the checks:

```powershell
npm run generate:content
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

Caption availability must be checked **per episode**, even within one playlist. A series may mix creator-provided subtitles, automatic captions, and videos with no caption track. Start every episode with:

```powershell
yt-dlp --list-subs --no-warnings "{youtube-url}"
```

Then use the first applicable path below. Do not assume that a failed caption download for one episode applies to the rest of the series, and avoid broad selectors such as `en.*`: YouTube can expose hundreds of auto-translated `*-en` tracks, causing a slow accidental batch download.

**1. Creator-provided English subtitles:** if `Available subtitles` lists `en`, prefer that reviewed/source track:

```powershell
yt-dlp --skip-download --write-subs --sub-langs en --sub-format vtt `
  -o "assets\captions\{series-slug}\episode-{NN}.%(ext)s" "{youtube-url}"

Move-Item "assets\captions\{series-slug}\episode-{NN}.en.vtt" `
  "assets\captions\{series-slug}\episode-{NN}.vtt"
```

**2. YouTube automatic English captions:** if there is no creator subtitle but `Available automatic captions` lists `en-orig`, download that track:

```powershell
yt-dlp --skip-download --write-auto-subs --sub-langs en-orig --sub-format vtt `
  -o "assets\captions\{series-slug}\episode-{NN}.%(ext)s" "{youtube-url}"

Move-Item "assets\captions\{series-slug}\episode-{NN}.en-orig.vtt" `
  "assets\captions\{series-slug}\episode-{NN}.vtt"
```

For standalone lectures, use the equivalent `assets\captions\standalone\{speaker-slug}\{id}.vtt` destination. `publish.ps1 -Standalone` attempts this mechanical caption scaffolding automatically; the series publishing path currently uploads the video only, so series captions still follow this per-episode decision flow.

**Always run `npm run clean-vtt` after downloading any YouTube auto-captions.** YouTube's auto-caption VTTs pin every cue to the far left with settings like `align:start position:0%` on the timing line. The browser's native `<track>` renderer honours those settings, so the captions render hard against the left edge instead of bottom-centre — very visible on iPhone. `scripts/clean-vtt.js` strips those per-cue positioning settings (leaving the text untouched) so captions fall back to the default bottom-centre placement. It is idempotent and safe to run on the whole `assets/captions` tree. `npm run check` now includes `check:vtt`, which fails if any committed VTT still carries positioning settings — so this can't silently regress.

Automatic captions are useful as an accessibility fallback, but they are not a reviewed transcript. Spot-check timing and wording, and prioritize human correction of Quran quotations, Arabic terms, names, and theological statements.

### Generating captions when YouTube has none

**3. Local transcription fallback:** when `--list-subs` reports neither subtitles nor automatic captions, `scripts/generate-captions.js` transcribes the audio directly with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) and writes a WebVTT file in the same cue format as the rest of `assets/captions/`. This is the repository's timed-caption fallback; it does not call the ChatGPT or OpenAI API. ChatGPT may help a maintainer review wording or summarize an already generated transcript, but it should not be confused with the tool that creates the timed VTT cues.

Requires `ffmpeg` on `PATH` and `pip install faster-whisper` (CPU-only, no GPU/torch needed).

```powershell
node scripts/generate-captions.js `
  "https://videos.improvingmuslim.com/{series-slug}/{series-slug}-ep-{n}.mp4" `
  "assets/captions/{series-slug}/episode-{NN}.vtt" `
  --model medium --language en --prompt "subhanahu wa ta'ala, insha'Allah, alhamdulillah, sahaba, hijrah, Makkah, Madinah"
```

The first argument accepts either the R2 `videoSrc` URL or a local file path — ffmpeg streams straight from a URL, so there's no separate download step. Pipeline: ffmpeg extracts a 16kHz mono WAV, `scripts/transcribe-whisper.py` runs faster-whisper over it, and the result is piped through `clean-vtt.js` automatically.

Notes:
- Process mixed playlists one episode at a time: use the source subtitle when present, then run faster-whisper only for the episodes whose `--list-subs` result is empty.
- `--model`: `medium` is a reasonable speed/accuracy default on CPU. Use `large-v3` for higher accuracy on Arabic terms and names if you can tolerate a slower run.
- `--prompt`: a comma-separated list of terms/names likely to appear — faster-whisper uses it to bias recognition, not as literal output text. Worth customizing per speaker/series.
- Whisper output is properly capitalized and punctuated, unlike the lowercase, punctuation-light style of the YouTube-auto-caption-derived files elsewhere in `assets/captions/`. That's a cosmetic difference only (`generate-transcript-index.js` and `generate-catalog.js` strip all text formatting for search indexing anyway) — leave as-is unless you want visual consistency across caption files.
- This is machine transcription same as YouTube's own auto-captions — same review guidance above applies: spot-check timing and prioritize human correction of Quran quotations, Arabic terms, names, and theological statements before treating it as a reviewed transcript.

**Full workflow, step by step** (this is what was actually run to caption Life of Muhammad (Mufti Menk) Day 1 and Day 2, both of which only had generic "Day N" titles and no YouTube captions):

1. Run `scripts/generate-captions.js` (command above) with the episode's `videoSrc` URL and a destination path following the existing `assets/captions/{series-slug}/episode-{NN}.vtt` convention.
2. Read through the resulting transcript to understand what the episode actually covers — generic series titles like "Day 1"/"Day 2" say nothing about content, so this is also the moment to catch a better title. Look for named events, people, or themes (e.g. "the Year of the Elephant," "Arabia before Islam") rather than summarizing generically.
3. Propose 1-3 title options in the site's plain, descriptive style (see existing titles like `"An introduction"`, `"Sincerity (Ikhlas)"` in `data/change-of-heart-data.js`) and get the title confirmed before changing it — renaming published content is worth a second pair of eyes.
4. Add `captionsSrc` to the episode entry in the series' `data/*-data.js` file, and update `title` once confirmed.
5. Regenerate derived data: `npm run catalog && npm run transcript-index`, and if the title changed, also `npm run seo-pages && npm run sitemap` (the title is baked into generated watch/series pages and sitemap entries).
6. Run `npm run check` (or at least `check:vtt`, `check:catalog`, `check:transcript-index`, `check:seo-pages`, `check:sitemap`, `check:smoke`) to confirm nothing drifted.
7. Spot-check in a browser: confirm the page `<title>` reflects the new episode title, and that the `<track>` element's cues load (`document.querySelector('video track').track.cues.length` should be non-zero once the track fires its `load` event).

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
npm run transcript-index
npm run seo-pages
npm run sitemap
```

(`npm run catalog` regenerates `data/catalog-data.js`, the related-lectures index, and `npm run transcript-index` regenerates `data/transcript-index-data.js`, the transcript search index — run both whenever episode data, standalone lectures, or captions change.)

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

**Cloud sync (Firebase):** When a user signs in from guest mode, `scripts/firebase-auth.js` merges the device's learning data into the account before continuing real-time sync. Newer progress and notes win, completed lectures stay completed, saved items are unioned, and the account's public-leaderboard choice remains authoritative. Signing in on a new device with no guest activity pulls the previous account progress immediately. See the Firebase Authentication section below.

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

Built via `window.IMUtils.notesKey(series, episode)` / `standaloneNotesKey(lecture)`. Stored value: `{ text, updatedAt }`. For signed-in users it is part of the account snapshot synced to Firestore; guest notes remain isolated on the device — see the Firestore data structure below.

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
3. On first sign-in from guest mode: snapshots the guest cache for sign-out restoration, keeps it visible during hydration, merges it with the signed-in user's Firestore document, and persists the merged result. Switching directly between different accounts still clears the previous account cache before hydration.
4. On every localStorage write: debounces a push to Firestore (3-second delay) so frequent progress saves don't burn write quota.
5. Hands Firebase user/database access to `scripts/streak-ui.js`, which writes only opt-in public display names and streak summaries to `leaderboard/{uid}`. Watch history and saved items are never public.
6. On sign-out: stops account syncing, clears the account cache, and restores the isolated guest browser data.

### Firestore data structure

```
users/{uid}/data/sync  (single document)
  progress: { "lecture-progress:playlistId:episodeId": { currentTime, duration, updatedAt, completed, _card }, ... }
  notes: { "lecture-notes:playlistId:episodeId": { text, updatedAt }, ... }
  saved: [ { key, type, title, subtitle, url, savedAt }, ... ]
  streak: {
    targetMinutes,       // always 15 -- fixed, not user-selectable (see below)
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
  targetMinutes: 15
  lastCompletedDate: "YYYY-MM-DD"
  activeThrough: "YYYY-MM-DD"  // public validity boundary; includes banked freeze coverage without exposing freeze count
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
- Leaderboard rows may only contain safe public fields: `displayName`, `current`, `best`, `targetMinutes`, `lastCompletedDate`, `activeThrough`, and `updatedAt`.
- Emails, watch history, saved items, and detailed daily heatmap data are not allowed in public leaderboard rows.
- `searchEvents/{eventId}` is create-only for signed-in users and cannot be read, updated, or deleted by clients.
- Admin dashboard reads are limited in Firestore rules to the allowlisted admin email in `isAdmin()`.

Deploy rules after editing them:

```powershell
firebase deploy --only firestore:rules --project improving-muslim
```

### Streak Ranks and Freezes

The daily streak goal is fixed at 15 minutes of actual lecture playback for every user (not user-selectable) so the leaderboard's day counts are directly comparable across everyone. `normalizeStreak` migrates stored 30-minute records to 15 minutes and immediately credits the current day when its saved watch time already reaches the new threshold. The storage and normalization logic lives in `scripts/utils.js` (`normalizeStreak`, used by `watch-page.js` when recording playback). The streak navigation button, panel, heatmap, and leaderboard UI live in `scripts/streak-ui.js`. `scripts/firebase-auth.js` stays focused on auth/sync and forces merged cloud records onto the current fixed target before writing them back.

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

The static architecture is still a good fit for the current product: it is inexpensive to host, resilient when optional services fail, and easy to deploy. `npm run check:content` now blocks the main catalog-drift and publishing-error classes locally and in CI. It intentionally performs no network requests; external R2 availability belongs in the scheduled content-health check below.

Prioritize these improvements before the catalog and contributor count grow substantially:

1. **Generate the shared page shell.** Headers, navigation, footers, Firebase script order, and cache-bust strings are duplicated across many HTML templates. Introduce a small repository-owned generator or include system that still emits plain static HTML; do not add a client framework merely to solve authoring duplication.
2. **Split the largest controllers by feature boundary.** As `scripts/script.js` and `scripts/watch-page.js` grow, extract search orchestration, catalog rendering, progress, notes, and player recovery into testable modules with explicit interfaces. Preserve the current global APIs temporarily for compatibility.
3. **Add focused data and behavior tests.** Unit-test catalog merging, progress/streak normalization, Firebase merge behavior, route helpers, and search ranking. Keep Playwright for a few critical end-to-end journeys instead of making every edge case a browser test.
4. **Automate content-health checks separately from pull-request CI.** A scheduled or manually triggered job can check external R2 media, caption URLs, remote-feed availability, and broken outbound links without making ordinary development depend on network stability.

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

`npm run check` runs the JavaScript, accessibility, generated page-shell and SEO-page checks, sitemap checks, and Playwright browser smoke checks. The smoke suite uses `playwright.config.js`, `tests/smoke.spec.js`, and the dependency-free local server in `scripts/test-server.js`.

After a shell change, edit `scripts/page-shell.js` and run `npm run generate:content`; never edit marked shell regions in HTML directly. After any lecture, episode, caption, thumbnail reference, speaker, or series-registry change, also run `npm run generate:content`, then `npm run check`. The generation command deliberately updates the page shell and all content-derived outputs together so navigation, search, recommendations, canonical routes, and the sitemap cannot drift independently.

## Deployment Workflow

### Main-branch-only policy

All repository work is committed and pushed directly to `main`. Do not create local or remote feature branches, draft branches, or pull requests for this repository. Before starting work, switch to `main` and synchronize it with `origin/main`. Keep commits focused, preserve unrelated working-tree changes, run the relevant checks, and push the completed commit directly to `origin/main`. This policy applies to human contributors, automation, and coding agents, and overrides generic workflows that default to branches or pull requests.

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
