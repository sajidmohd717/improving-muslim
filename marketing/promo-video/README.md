# Promo video (Remotion)

A 26-second vertical (1080x1920) app-ad style promo for improvingmuslim.com,
built as code with [Remotion](https://remotion.dev). Screenshots of the live
site scroll inside a 3D-tilted phone mockup over the brand's dark palette.

## Workflow

1. Start the dev server (`npm run dev` in the repo root, port 4173).
2. Re-capture screenshots after site changes:
   ```
   node marketing/promo-video/capture-screens.cjs
   ```
   Captures phone-sized (375x812 @3x) shots into `public/` and copies the
   speaker photos there too.
3. Preview / edit interactively:
   ```
   npm run studio        # in marketing/promo-video
   ```
4. Render:
   ```
   npm run render        # v1 -> out/promo.mp4
   npm run render:v2     # v2 -> out/promo-v2.mp4 (30fps)
   npm run render:v3     # v3 -> out/promo-v3.mp4 (same video at 60fps)
   npm run render:v3:hq  # v3 at 2x (2160x3840) -> out/promo-v3-hq.mp4
   ```

### Render quality

`remotion.config.ts` sets PNG frame capture (default JPEG q80 softens text)
and CRF 15. **Upload the `:hq` (2160x3840) render** — Instagram/TikTok
recompress uploads, and 4K sources survive their compression visibly crisper
than 1080p ones. Screenshots are captured at 4x density so they stay sharp at
2x scale. If a single `:hq` run is too long for one sitting, render in chunks
with `--frames=A-B` into part files and concat with
`ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4`.

## Series strategy

One video per feature: each future video leads with a single differentiator
(notes, streaks, series progress, captions, topics, history…) instead of a
general overview — whichever feature's video performs best shows what pulls
people to the site. Full list and production rules live in
`marketing/README.md` ("Promo video strategy"). Copy rule: it's a **website,
not an app** — never imply a download.

## Versions

- **v1** (`src/Promo.tsx`) — dark green background, speaker names as text in the hook.
- **v2** (`src/PromoV2.tsx`) — brighter cream/gold background, speaker profile
  photos (Menk, Omar Suleiman, Ali Hammuda, Navaid Aziz) in the hook, and an
  iOS status bar (time/battery) on the phone mockup for realism.
- **v3** — the exact same composition as v2 rendered at 60fps for smoother
  scrolling. Not a separate file: v2's timings are authored at a 30fps base and
  scale with the composition's fps (see `BASE_FPS` in `PromoV2.tsx`), so edits
  to `PromoV2.tsx` change both v2 and v3.

## Structure

- `src/Promo.tsx` / `src/PromoV2.tsx` — scenes, copy, and timing (scene lengths S1–S5 at top)
- `src/Phone.tsx` — the 3D phone mockup + scrolling screenshot
- `src/Root.tsx` — composition registration (1080x1920 @ 30fps)

## Notes

- Music is added afterwards (e.g. in CapCut); the render is silent.
- Featured series: Life of Muhammad (PBUH) by Mufti Menk (most-complete series).
- `out/` (rendered MP4s) and `public/` (captured screenshots + copied photos)
  are gitignored — only source code is committed; both regenerate from the
  commands above. Keep finished videos you want to preserve somewhere outside
  the repo (they're overwritten by re-renders).
