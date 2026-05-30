# Islamic Lecture Series Collections

A lightweight static website for browsing curated Islamic lecture playlists by topic and speaker.

## Run locally

Open `index.html` directly in a browser, or serve the folder locally:

```bash
npm run dev
```

The site is plain HTML, CSS, and JavaScript. It fetches live category data from the public `series-api` repository and falls back to a small local collection if that request fails.
