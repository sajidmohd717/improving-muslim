# UI/UX Revamp Plan

Audit date: 2026-07-02. Reviewed every core page at mobile width plus dark mode, with DOM/animation/performance inspection. This document is the agreed scope for the "high standard" polish pass. Work through phases in order; each phase ships independently.

## Where the site already stands

These exist and are good — do not rebuild them:

- **Cross-document View Transitions** (`styles/transitions.css`) — pages already crossfade with pinned header/nav.
- **Motion system** (`styles/animations.css`) — card entrance stagger, skeleton shimmer, hover lifts, active press states, full `prefers-reduced-motion` handling.
- **Dark mode** — verified working, looks intentional.
- **Performance** — 65 ms load, 681 DOM nodes, all images lazy. This is the budget to protect: every change below must keep the site this fast.
- **Series detail page** — hierarchy is solid (eyebrow → title → CTA → availability → episodes with filters). Use it as the internal quality bar.

## Findings

### P0 — experience-defining (Phase A + B)

1. **Homepage order is randomized per visit** (`scripts/script.js` `stableRandomKey`). Stable within a session, reshuffled on the next. Users build spatial memory ("Seerah was near the top") and the site breaks it daily. *Fix: deterministic, curated default order from the registry; keep "random discovery" as an explicit Sort option if desired.*

2. **No resume path on the homepage.** A returning learner on episode 40 sees the same flat 20-card list as a first-time visitor. The continue-watching component exists (`continue-card` in script.js) but there is no prominent "Continue: <episode>, <time> left" hero at the top. *Fix: when progress exists, the first thing on the page is a large resume card (thumbnail, episode title, progress bar, minutes left). This is the single biggest retention lever.*

3. **Watch page "Up Next" shows the series title, not the next episode.** No thumbnail, no episode name, no duration — the invitation to continue is a label. *Fix: real next-episode card (thumbnail, "Ep 2 — An introduction (Part 2)", duration, progress if partially watched). End-of-video autoplay countdown already exists; connect the two visually.*

4. **Infinite 16 s `hero-glow` animation on `<body>`** (`styles/base.css:80`). The page never stops compositing — battery drain on mobile, and it defeats paint-holding optimizations. *Fix: remove, or run 2 iterations and settle. Nobody notices a background gradient stop moving; everyone's battery notices it not stopping.*

### P1 — polish and hierarchy (Phase B + C)

5. **Card metadata competes with itself.** Each series card stacks: CAPS category eyebrow → title → speaker → full-width label pill ("DEEP STUDY") → second full-width availability pill ("4 of 46 available"). The two stacked full-width pills read as buttons, eat ~70 px of vertical space per card, and flatten the hierarchy. *Fix: one compact meta row — small inline chips after the speaker line. Availability becomes a thin progress-style bar or short chip, not a banner.*

6. **Filter chip row shows a scrollbar** and offers 16 categories on mobile. *Fix: hide scrollbar (keep scrollability), add edge-fade affordance; consider collapsing the tail categories behind a "More" chip. Order chips by content volume.*

7. **Explore page is text-only.** Tall description cards, one per category, no imagery — reads like a settings page. *Fix: compact 2-column tile grid with a representative thumbnail or icon per topic; counts as small chips, not pills-above-title.*

8. **Speakers directory truncates bios mid-sentence** with tiny (~46 px) portraits. *Fix: larger portraits, 1-line role summary instead of truncated paragraph, series/lecture count, clear tap affordance.*

9. **No thumbnail → player morph.** The View Transitions plumbing exists; assigning a per-card `view-transition-name` on the clicked thumbnail so it morphs into the video player is the highest-wow moment available and requires no framework.

10. **Watch page details:** copy "Learn background audio" / "Learn Picture in Picture" is unclear (rename: "Keeps playing in the background", "Pop out the video"); large dead space below the collapsed episode list on mobile; no keyboard-shortcut hints on desktop.

### P2 — platform and flow (Phase D)

11. **PWA gap.** Manifest exists but no service worker → not installable, no offline shell. An icon on the home screen is where "open this instead of YouTube" is won. Scope: offline app shell + cached UI assets only (videos stay online).

12. **`pages/series.html` duplicates Explore** and drifts (it was missing 4 series until 2026-07-02). Make Explore canonical; turn series.html into a redirect or generate it from the registry.

13. **Empty states are dead ends** (History/Saved: text + one button). *Fix: show 2–3 actual starter series cards under the explanation.*

14. **No first-visit statement.** The homepage opens with search + chips; the mission ("focused Islamic lectures without ads or algorithm bait") is only on About. *Fix: one quiet hero line above the fold for visitors with no progress, replaced by the resume card once progress exists.*

## Phases

**Phase A — Flow fixes (highest impact, small diffs)**
Stable homepage order (#1) · resume hero on homepage (#2) · real next-episode card on watch (#3) · kill infinite body animation (#4). *Acceptance: a returning user reaches "continue where I left off" in one tap from open; battery/paint idle after load.*

**Phase B — Card & chip system**
Card metadata redesign (#5) · chip row cleanup (#6) · watch-page copy and layout details (#10). *Acceptance: every card has exactly one metadata line + one optional chip; no visible scrollbars anywhere.*

**Phase C — Page-level upgrades**
Explore visual grid (#7) · speakers directory (#8) · thumbnail→player morph (#9) · empty states (#13) · first-visit hero (#14).

**Phase D — Platform**
PWA offline shell (#11) · series.html canonicalization (#12).

## Rules for all phases

- Plain HTML/CSS/JS. No build step, no framework (DEV_README covenant).
- Respect `prefers-reduced-motion` for every new animation.
- `npm run check` green before every push; verify each change at 380 px width and in dark mode.
- Protect the performance budget: no new render-blocking resources, keep homepage under 1,000 DOM nodes.
- The parchment-and-emerald identity stays. Refine, don't rebrand.
