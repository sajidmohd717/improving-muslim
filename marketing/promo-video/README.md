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

### Render quality — the crispness checklist

Hard-won rules from v1–v3. Follow all of them for every future video so
nothing ships soft:

**Pipeline (already configured — don't undo):**

- `remotion.config.ts` sets **PNG frame capture** (Remotion's default is JPEG
  q80, which blurs text before encoding) and **CRF 15** (default 18 smears
  fine edges).
- **Always render and upload the `:hq` 2x (2160x3840) version.** Platforms
  recompress every upload; 4K sources survive it visibly crisper than 1080p.
  If a single run is too long, render chunks with `--frames=A-B` and concat
  with `ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4`.
- **Capture screenshots at 4x density** (set in `capture-screens.cjs`) so
  bitmaps inside the phone are never upscaled, even at 2x render.
- When adding audio afterwards (CapCut etc.), **export at 4K / "match
  source"** — don't throw the resolution away at the last step.

**On-screen text (the captions/headlines outside the phone):**

- **Use the brand webfonts, bundled** — Inria Serif 700 for headings, Inter
  for body (same as every other marketing asset). Do NOT fall back to Georgia
  or other system serifs: thin tapered serifs at display sizes read soft.
  Bolder, even strokes render crisper.
- **Snap animated offsets to whole pixels** (`Math.round` the translateY
  values). Fractional positions force Chrome to smear glyphs across pixel
  boundaries for the entire animation.
- Keep entrance animations short so text reaches its crisp resting state
  quickly; encoders soften moving, semi-transparent elements.
- Low-contrast text always *reads* blurry even when it isn't — muted gray
  sub-captions cost sharpness perception; darken a step if in doubt.

**Source images:**

- Speaker profile photos must be comfortably larger than their displayed
  size at 2x (e.g. a 172px circle needs a ~700px+ source). Current soft spots:
  Mufti Menk (225px) and Omar Suleiman (176px) sources — replace with
  higher-res photos when available.

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
