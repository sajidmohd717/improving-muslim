# Content Operations

This is the canonical release checklist for adding, changing, or removing lectures on Improving Muslim. Use it before editing generated files or trying to remember which indexes need rebuilding.

The detailed architecture, hosting setup, and troubleshooting reference remain in [DEV_README.md](./DEV_README.md).

## The two commands to remember

After any content change:

```powershell
npm run generate:content
npm run check
```

`generate:content` rebuilds, in order:

1. `data/catalog-data.js` for related lectures and recommendations.
2. `data/transcript-index-data.js` for transcript search.
3. Canonical pages under `series/` and `watch/`.
4. `sitemap.xml` for search-engine discovery.

`npm run check` must finish successfully before a content release is committed or deployed.

## Files that are edited by people

- `data/standalone-lectures-data.js` for standalone lecture metadata.
- `data/{series-slug}-data.js` for series episode metadata.
- `data/series-registry.js` for series-level metadata and availability counts.
- `data/category-taxonomy.js` for category names, descriptions, aliases, visibility, and ordering.
- `data/speaker-data.js` when a new speaker is introduced.
- `assets/thumbnail/` for local thumbnails.
- `assets/captions/` for WebVTT captions.
- `DEV_README.md` when its human-readable content snapshot changes.

## Files that are generated

Never edit these by hand:

- `data/catalog-data.js`
- `data/transcript-index-data.js`
- Files under `series/`
- Files under `watch/`
- `sitemap.xml`

If a generated file is wrong, correct the source metadata or generator and run `npm run generate:content` again.

## Adding a standalone lecture

### 1. Publish and scaffold

For a YouTube source:

```powershell
.\scripts\publish.ps1 -Standalone `
  -SpeakerSlug "speaker-slug" `
  -LectureSlug "lecture-slug" `
  -Url "https://www.youtube.com/watch?v=VIDEO_ID"
```

For a batch, create a temporary text file containing one item per line:

```text
speaker-slug|lecture-slug|https://www.youtube.com/watch?v=VIDEO_ID
```

Then run:

```powershell
.\scripts\publish.ps1 -Standalone -BatchFile ".\standalone-batch.txt"
```

The publisher uploads the H.264 MP4 to R2 and scaffolds the thumbnail, captions, duration, date, source URL, and metadata object. The batch file is an operator input, not proof that an item is published; only data present in `data/standalone-lectures-data.js` is part of the catalog.

### 2. Complete editorial metadata

Add the lecture object to `data/standalone-lectures-data.js`. Confirm every required field:

```js
{
  id: "unique-lecture-slug",
  title: "Public lecture title",
  speaker: "Speaker Name",
  speakerSlug: "speaker-slug",
  categories: ["primary-category", "optional-secondary-category"],
  topic: "Short display topic",
  typeLabel: "Standalone Video",
  published: "YYYY-MM-DD",
  duration: 3600,
  sourceUrl: "https://www.youtube.com/watch?v=VIDEO_ID",
  thumbnailSrc: "./assets/thumbnail/standalone/speaker-slug/unique-lecture-slug.jpg",
  videoSrc: "https://videos.improvingmuslim.com/speaker-slug/stand-alone/unique-lecture-slug.mp4",
  captionsSrc: "./assets/captions/standalone/speaker-slug/unique-lecture-slug.vtt",
  description: "A concise, accurate description.",
  takeaways: ["Reviewed takeaway"],
  recap: `Reviewed recap`,
}
```

Use `categories`, not the legacy singular `category` field. Put the category that best matches learner intent first.

Every category slug must already exist in `data/category-taxonomy.js`. Add or rename a category there once; the homepage, Explore directory, dedicated category page, and sitemap will all update from that shared source. Do not create or hand-edit a separate page for each topic. `npm run check:taxonomy` fails when maintained content uses an unknown category or when a public topic is omitted from homepage filters.

Takeaways and recaps must come from a reviewed, sufficiently reliable transcript or from a careful review of the lecture itself. If automatic captions are too garbled to support accurate editorial notes, omit `takeaways` and `recap`, leave a short maintainer comment explaining why, and revisit the item when a corrected transcript becomes available. Never invent or infer religious claims merely to fill those fields.

### 3. Add or verify the speaker

If the speaker is new, add one record to `data/speaker-data.js`:

```js
{
  name: "Speaker Name",
  slug: "speaker-slug",
  image: "./assets/speaker/speaker-slug.jpg",
  bio: "A concise, source-verified biography.",
}
```

The `speaker` and `speakerSlug` values in the lecture must exactly match this record. Prefer a local, properly licensed speaker image. A temporary platform icon is acceptable during drafting but should be replaced before a major promotion.

### 4. Validate the media and assets

- Confirm the source URL opens and is the intended lecture.
- Confirm title, upload date, and duration against the source.
- Confirm the R2 URL returns `200 OK` and `Content-Type: video/mp4`.
- Confirm the server advertises `Accept-Ranges: bytes` so seeking works.
- Confirm the MP4 is H.264 video with AAC audio.
- Confirm the publisher selected 720p for videos longer than 20 minutes or 1080p for videos up to 20 minutes, unless a documented `-MaxHeight` override was intentional.
- Confirm the remote duration matches the metadata duration.
- Confirm the thumbnail exists locally and is preferably 1280x720.
- Confirm the caption file begins with `WEBVTT` and covers the expected runtime.
- Run `npm run check:vtt` after adding YouTube captions.
- Spot-check Arabic terms, names, Qur'an quotations, and theological statements in automatic captions.

Useful source check:

```powershell
yt-dlp --skip-download --print "%(id)s|%(title)s|%(uploader)s|%(upload_date)s|%(duration)s" "SOURCE_URL"
```

Useful media check:

```powershell
ffprobe -v error `
  -show_entries format=duration `
  -show_entries stream=codec_name,codec_type,width,height `
  -of json "R2_VIDEO_URL"
```

### 5. Build and verify

```powershell
npm run generate:content
npm run check
```

Then verify locally:

- The homepage card appears.
- Search finds the lecture by title, speaker, and topic.
- The canonical `/watch/standalone/{id}/` page exists.
- The watch page shows the correct title, speaker, topic, date, thumbnail, and captions.
- Playback starts, seeking works, and audio is audible on a real device.
- Save and share controls behave correctly.
- Related lectures and Up next render after the catalog has been rebuilt.
- The new speaker profile includes the lecture.

The homepage automatically includes newly maintained content in its shuffled catalog. It renders the first 24 matching cards on desktop or 12 on mobile and reveals the rest through `Load more`; do not hand-place a new card or alter a batch size during publishing. When checking a new item that falls beyond the first batch, use search, its topic filter, or `Load more` to confirm it is discoverable.

## Adding a series episode

### 1. Publish the episode

```powershell
.\scripts\publish.ps1 `
  -Series "series-slug" `
  -Episode 10 `
  -Url "https://www.youtube.com/watch?v=VIDEO_ID"
```

### 2. Complete the episode record

- Keep the existing episode `id`; progress is keyed to it.
- Add the real R2 `videoSrc` only after upload succeeds.
- Add `captionsSrc` when a caption file exists.
- Add reviewed `takeaways` and `recap` for lecture content.
- For language courses, use `grammarNotes` and `recap` instead.
- Confirm the local episode thumbnail exists.

### 3. Update the registry

In `data/series-registry.js`:

- Increment `availableCount` to the actual number of episodes with `videoSrc`.
- Update the `?v=` cache-bust on the series `dataFile` entry.
- Do not change `episodeCount` unless the source series itself changed.

Explore uses `availableCount` to report currently watchable series episodes. An incorrect value therefore affects both the series card and public category counts; keep it equal to the number of episode records that currently have a real `videoSrc`.

### 4. Build and verify

```powershell
npm run generate:content
npm run check
```

Verify the series page, episode filters, Start watching/Continue watching behavior, canonical watch page, next/previous navigation, progress saving, captions, and related lectures.

## Changing existing content

Run the complete generation pipeline after changing any of the following:

- Lecture or episode titles.
- Speaker names or slugs.
- Categories, topics, descriptions, takeaways, or recaps.
- Publication dates or durations.
- Video, thumbnail, or caption paths.
- Caption contents.
- Series registry metadata.
- Adding or removing a `videoSrc`.

Even a caption-only change affects search and recommendation term vectors, so it requires both generated indexes.

## Removing or hiding content

1. Remove the item from its maintained data source, or remove `videoSrc` when an episode should remain listed as unavailable.
2. Remove obsolete local thumbnails or captions only after confirming nothing else references them.
3. Run `npm run generate:content`.
4. Run `npm run check`.
5. Confirm the canonical route and sitemap entry were removed or updated as intended.
6. Remove the R2 object separately when the direct media URL must stop working.

Never delete generated routes by hand; let the generator reconcile them.

## Before committing a content release

- [ ] All intended metadata is present and reviewed.
- [ ] No `TODO` placeholders remain in published records.
- [ ] Speaker records and slugs match.
- [ ] Local thumbnails and referenced captions exist.
- [ ] Videos return successfully from R2.
- [ ] `npm run check:content` passes with no integrity errors.
- [ ] `npm run check:vtt` passes.
- [ ] `npm run generate:content` completes.
- [ ] `npm run check` completes with no failures.
- [ ] The expected generated files are reviewed in `git diff`.
- [ ] New canonical watch pages are present.
- [ ] The sitemap contains the new routes.
- [ ] At least one desktop and one mobile-width smoke check succeeds.
- [ ] A real phone spot-check confirms playback, seeking, audio, captions, and sharing.
- [ ] The human-readable catalog snapshot in `README.md` and `DEV_README.md` is updated when totals change.

## If a check fails

| Failure | Usual cause | Fix |
|---|---|---|
| `check:content` | Duplicate IDs/routes, invalid metadata, count drift, missing local assets, or missing generated discovery paths | Read every reported owner, fix the maintained source or asset, then run `npm run generate:content` |
| `check:catalog` | Metadata or captions changed | Run `npm run catalog` or `npm run generate:content` |
| `check:transcript-index` | Captions or lecture data changed | Run `npm run transcript-index` or `npm run generate:content` |
| `check:seo-pages` | A public route is missing or stale | Run `npm run seo-pages` or `npm run generate:content` |
| `check:sitemap` | Public content routes changed | Run `npm run sitemap` or `npm run generate:content` |
| `check:vtt` | YouTube cue positioning remains | Run `npm run clean-vtt`, inspect the diff, then rebuild |
| `check:smoke` | UI/runtime regression or stale generated route | Read the failing test, fix the source, regenerate, and rerun |

Do not bypass a failing generated-file check by manually editing its output. Fix the maintained source and regenerate.

## Release rule

A content release is ready only when the maintained metadata is reviewed, all derived artifacts have been regenerated, the complete check suite is green locally, and the same check is green in GitHub Actions after pushing.
