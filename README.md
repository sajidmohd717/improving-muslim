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

The Change of Heart series has a dedicated episode list at `series-change-of-heart.html`.
Individual episodes open in `watch.html` with a focused HTML5 video player and simple next/previous navigation.

Self-hosted MP4 files should be added under `assets/videos/change-of-heart/` using filenames like `episode-01.mp4`.
Only host video files that you have permission to distribute.
