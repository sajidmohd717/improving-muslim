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

**Shadows and blurs under transforms:**

- **Never put a large blur radius on an element that also carries a `scale()`
  transform.** The scale multiplies the blur, and the `--scale=2` render
  doubles it again — a 120px shadow blur became ~380px, past the point where
  Chrome tiles the rasterization, and the tile seams showed as rectangular
  banding across the background. It only appeared in the 2x render, so check
  `:hq` output specifically, not just 1x stills.
- Author shadow offsets/blurs in final-composition pixels and divide by the
  element's scale (see the `px()` helper in `Phone.tsx`). This keeps the
  rendered blur fixed and identical at any device `width`.
- Keep shadow color in the brand ink (`24,32,27`) rather than pure black —
  black shadows read muddy on the cream background.

**Source images:**

- Speaker profile photos must be comfortably larger than their displayed size
  at 2x. `capture-screens.cjs` now checks this and warns (loudly, at the end)
  for anything under 350px — it warns rather than fails because not every
  photo it copies belongs to the video being rendered.
- Still undersized, both used by **video #1's** row: `mufti.jpeg` (225px) and
  `os.jpg` (176px). Replacing them in `assets/speaker/` sharpens the live
  site's speaker pages too, not just a re-render.

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

## Videos

| Video | Feature led | Composition | Render |
|---|---|---|---|
| #1 | Distraction-free | `PromoV3` (`src/PromoV2.tsx`) | `npm run render:v3:hq` |
| #2 | My Notes | `PromoNotes` (`src/PromoNotes.tsx`) | `npm run render:notes:hq` |

Each video is one composition file holding only its scenes and copy; the
palette, fonts, timing helpers, background, and phone screen live in
`src/shared.tsx`. Add video #3 as a new file the same way — don't fork the
shared parts.

### Shape of a feature video

Video #2's structure, which is the template for the rest of the series —
a viewer who has never heard of the site needs to be told what it is before
a feature means anything:

1. **Who it's for** — a row of speaker faces, a different set per video so the
   series shows breadth. Only speakers whose content is actually on the
   platform.
2. **What it is** — the home feed scrolling, so the product is established.
3. **The pivot** — a one-line full-screen card turning to the feature.
4. **The feature** — two scenes: doing it, then the payoff.
5. **End card** — same wordmark and URL every time.

Copy rules learned so far: don't claim to *be* the viewer's favourite platform
(attach "favourite" to the speakers instead — it's true and warmer), and don't
call an existing feature "new". "One thing YouTube can't do" is both honest and
a sharper hook.

### Capturing the screens

Screens are **real captures of the site**, never mock-ups — the promise is that
the video shows the product. Two capture scripts, both needing the dev server:

- `capture-screens.cjs` — the browsing screens (home, series, watch) plus the
  speaker photos.
- `capture-notes.cjs` — drives the actual notes editor: opens it, presses the
  real timestamp button, types the note, waits for autosave, switches to
  Preview, then taps the rendered timestamp so the player really seeks back.
  The typing is captured **frame by frame**, so the video plays real typing
  rather than a cross-fade. It writes `notes-manifest.json` with the typing
  frame count and the timestamp chip's measured position.

**Positioning overlays on a captured screen:** pass them to `DeviceScreen`'s
`overlay` prop. That anchors them to the screenshot's own top-left, so
coordinates measured in the browser line up directly — don't hand-compute
offsets for the mockup's status bar (that was wrong the first time, and the
tap indicator landed on the wrong line).

## Structure

- `src/shared.tsx` — palette, brand fonts, fps-independent timing helpers,
  `Background`, `StatusBar`, `DeviceScreen`. Shared by every video.
- `src/Promo.tsx` / `src/PromoV2.tsx` / `src/PromoNotes.tsx` — scenes, copy,
  and timing (scene lengths at the top of each)
- `src/Phone.tsx` — the 3D phone mockup + scrolling screenshot
- `src/Root.tsx` — composition registration (1080x1920 @ 30fps)

## Notes

- Music is added afterwards (e.g. in CapCut); the render is silent.
- Featured series: Life of Muhammad (PBUH) by Mufti Menk (most-complete series).
- `out/` (rendered MP4s) and `public/` (captured screenshots + copied photos)
  are gitignored — only source code is committed; both regenerate from the
  commands above. Keep finished videos you want to preserve somewhere outside
  the repo (they're overwritten by re-renders).
