# Islamic Lecture Series Collections

A lightweight static website for browsing curated Islamic lecture playlists by topic and speaker.

Visit the live site: https://sajidmohd717.github.io/islamic-lectures-react/

## Run locally

Open `index.html` directly in a browser, or serve the folder locally:

```bash
npm run dev
```

The site is plain HTML, CSS, and JavaScript. It fetches live category data from the public `series-api` repository and falls back to a small local collection if that request fails.

## Current video experience

Dedicated pages live under `pages/`. For example, the Change of Heart series is at `pages/series-change-of-heart.html`, and individual episodes open in `pages/watch.html` with a focused HTML5 video player and simple next/previous navigation.

Large MP4 files are hosted outside Git on Cloudflare R2 and referenced from the matching files in `data/`.
Only host video files that you have permission to distribute.

## Checks

Run syntax and accessibility checks before pushing:

```bash
npm run check
```

Feedback is collected through `pages/feedback.html` and is intended to route to `feedback@improvingmuslim.com`.
