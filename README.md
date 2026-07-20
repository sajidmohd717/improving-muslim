# Improving Muslim

Improving Muslim is a focused Islamic learning platform for watching curated lecture series without recommendation traps or unrelated distractions. It is designed around intentional study: find a topic, follow a series in order, save progress, take notes, and return where you left off.

Visit the live site: [improvingmuslim.com](https://improvingmuslim.com)

The application is intentionally built with plain HTML, CSS, and JavaScript; it does not use React or a client framework.

## What the platform includes

- Curated series, standalone lectures, topic browsing, speaker profiles, and typo-tolerant search
- A focused HTML5 video player with captions, resume progress, next/previous navigation, autoplay controls, and Media Session support
- Watch history, saved items, per-episode notes with clickable timestamps, and a 15-minute daily learning streak
- Optional Google sign-in to sync progress, notes, saved items, and streak data across devices
- An opt-in public streak leaderboard; private learning activity is not published
- Light, dark, and system themes, reduced-motion support, responsive navigation, and generated crawlable series/watch pages
- Local keyword search that works independently, with optional AI reranking through a Cloudflare Worker

As of 18 July 2026, the catalog contains 12 series and 27 standalone lectures, with 110 lectures currently watchable on the platform. More episodes are uploaded progressively; the live [upload roadmap](https://improvingmuslim.com/pages/roadmap.html) shows the current schedule.

## Run locally

Requirements:

- Node.js 20 or newer
- Python 3 (used by the lightweight development server)

```bash
npm install
npm run dev
```

Open `http://localhost:4173/`. Serve the project over HTTP rather than opening `index.html` through `file://`; captions and some browser features require a normal web origin.

The homepage enriches the local catalog with category data from the public `series-api` feed and caches that response. If the feed is unavailable, the local series registry remains a complete fallback for the platform's own catalog.

## Checks

Install Playwright's local browser once, then run the full validation suite:

```bash
npx playwright install chromium
npm run check
```

The check covers JavaScript syntax, static accessibility rules, the generated page shell and SEO routes, the sitemap, and Playwright smoke tests. GitHub Actions runs the same suite for pushes to `main`.

Useful individual commands:

| Command | Purpose |
|---|---|
| `npm run check:js` | Validate browser and data JavaScript syntax |
| `npm run check:a11y` | Audit maintained HTML templates |
| `npm run page-shell` | Refresh shared headers, footers, mobile navigation, assets, and common runtime scripts |
| `npm run check:page-shell` | Fail when a maintained page has stale shared shell markup |
| `npm run check:taxonomy` | Validate category definitions and every category used by maintained content |
| `npm run generate:content` | Regenerate the page shell, catalog, transcript index, canonical pages, and sitemap |
| `npm run seo-pages` | Regenerate canonical `/series/` and `/watch/` pages |
| `npm run sitemap` | Regenerate `sitemap.xml` from the catalog |
| `npm run clean-vtt` | Normalize YouTube captions to bottom-center placement |
| `npm run check:smoke` | Run browser smoke tests |

## Architecture and hosting

The browser application has no framework, bundler, or runtime build step. Catalog metadata lives in `data/`, browser behavior in `scripts/`, and focused stylesheets in `styles/`. Small Node.js scripts generate SEO entry pages and validate that generated files remain current.

The site is deployed from `main` with GitHub Pages. Videos are stored outside Git in Cloudflare R2, AI-assisted search runs behind a Cloudflare Worker, and optional account sync uses Firebase Authentication and Cloud Firestore.

For the repeatable video-publishing and release checklist, see [CONTENT_OPERATIONS.md](./CONTENT_OPERATIONS.md). For the repository layout, architecture, security boundaries, and detailed maintenance rules, see [DEV_README.md](./DEV_README.md).

## Content rights and privacy

Only upload or distribute material when the project has permission to do so. The platform records permission status and attribution on its [copyright page](https://improvingmuslim.com/pages/copyright.html).

The core experience works without an account and stores learning data on the device. Google sign-in is optional. See the live [privacy page](https://improvingmuslim.com/pages/privacy.html) for the data model and sync behavior.

Feedback is available through the site's [feedback page](https://improvingmuslim.com/pages/feedback.html).

Planning for a future Singapore legal entity, company operations, privacy responsibilities, fundraising, trademarks, and Meta business verification is recorded in [BUSINESS_AND_LEGAL.md](./BUSINESS_AND_LEGAL.md).
