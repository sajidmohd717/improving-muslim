# Improving Muslim iOS Developer Guide

This is the engineering handoff and continuation guide for the native iOS app.
Read the repository-level [`DEV_README.md`](../DEV_README.md) for the web platform,
content operations, Firebase schema, and mandatory Git workflow. Read
[`PRODUCT.md`](./PRODUCT.md) for the native product direction and design tokens.

## Current state

The first native foundation is complete and compiles on the repository's macOS
GitHub Actions runner. It currently provides:

- A native SwiftUI application targeting iOS 17 and iPadOS 17.
- Home discovery with search, topic filtering, and a per-launch shuffled feed.
- Explore and speaker browsing.
- Placeholder History and Saved destinations.
- AVKit video playback with the background-audio entitlement.
- A remote catalog loaded from `https://improvingmuslim.com/api/v1/catalog.json`.
- A generated bundled catalog used when the network request fails.
- Shared light and dark semantic colors derived from the web design.
- Initial Dynamic Type and VoiceOver treatment.
- An XcodeGen definition and a path-scoped Xcode build workflow.

This is a foundation, not the App Store MVP. Progress persistence, account sync,
saved items, history, notes, downloads, production media-session behavior, and
release assets are not implemented yet.

## Quick start on macOS

Requirements:

- Xcode 16 or newer.
- XcodeGen.
- Node.js 20 or newer for shared content generation and checks.

From the repository root:

```bash
npm install
npm run generate:content
cd ios
xcodegen generate
open ImprovingMuslim.xcodeproj
```

In Xcode, select the `ImprovingMuslim` scheme and an iOS 17+ simulator. A real
device requires selecting an Apple development team. The bundle identifier is
currently `com.improvingmuslim.app` and should not be changed casually once App
Store Connect, Sign in with Apple, push notifications, or associated domains use
it.

Run `xcodegen generate` again whenever [`project.yml`](./project.yml) changes.
Do not commit the generated `.xcodeproj` or `ImprovingMuslim/Info.plist`.

## Directory map

```text
ios/
├── project.yml                         XcodeGen source of truth
├── PRODUCT.md                          Product and visual decisions
├── DEV_README.md                       This continuation guide
└── ImprovingMuslim/
    ├── App/                            App entry point and root navigation
    ├── Components/                     Reusable presentation components
    ├── Core/                           Design system and cross-feature utilities
    ├── Features/
    │   ├── Explore/
    │   ├── Home/
    │   ├── Player/
    │   └── Speakers/
    ├── Models/                         Codable catalog and domain models
    ├── Services/                       Network, persistence, and platform services
    └── Resources/catalog.json          Generated offline fallback; never hand-edit
```

New work should remain feature-oriented. A substantial feature owns its views,
view-specific models, and supporting components under `Features/<Feature>/`.
Reusable domain or platform behavior belongs in `Core`, `Models`, or `Services`.
Avoid a single global view model that accumulates unrelated responsibilities.

## Shared catalog contract

The maintained JavaScript files under the repository's `data/` directory remain
the editorial source of truth. Native code must not introduce a second manually
maintained lecture list.

`scripts/generate-mobile-api.js` produces two identical generated files:

- `api/v1/catalog.json`, published by the website for native runtime requests.
- `ios/ImprovingMuslim/Resources/catalog.json`, bundled for resilient startup.

After any lecture, series, speaker, taxonomy, caption reference, thumbnail, or
media URL change, run:

```bash
npm run generate:content
npm run check
```

CI runs `npm run check:mobile-api` and fails if either copy is stale. Never edit
either JSON output directly.

The contract is versioned through `schemaVersion`. Additive optional fields may
be introduced within v1. Renaming fields, changing their types, changing stable
IDs, or removing fields requires a new schema version and a compatibility plan
for already-installed apps. `catalogVersion` is a deterministic content hash and
can be used for cache invalidation.

Stable identity rules:

- Series IDs are the existing series slugs.
- Episode IDs remain the existing source video IDs.
- Standalone lecture IDs remain their maintained slugs.
- Progress and notes must use the same identities as the website so account
  merging remains possible.

## Architecture direction

Use SwiftUI for product UI and Apple frameworks for platform capabilities.
Prefer small protocols at service boundaries so production services can be
replaced by deterministic test doubles.

The intended dependency direction is:

```text
SwiftUI feature views
        ↓
Feature state and domain operations
        ↓
Catalog / player / persistence / account service protocols
        ↓
URLSession, AVFoundation, MediaPlayer, Firebase, file storage
```

Views should not write directly to `UserDefaults`, Firebase, or the file system.
The current `CatalogStore` is deliberately small; continue separating player,
learning-state, download, and account responsibilities rather than expanding it
into a universal store.

Use Swift concurrency for new asynchronous work. UI-observed state belongs on
the main actor. Long-running file, media, and network operations must not block
the main thread.

## Next implementation sequence

Build and verify vertical slices in this order. Each slice should leave the app
usable and CI green.

### 1. Production player and local progress

- Introduce one shared player controller rather than creating unrelated players
  in multiple views.
- Configure `AVAudioSession` interruption, route-change, and headphone behavior.
- Publish title, speaker, artwork, elapsed time, and duration through
  `MPNowPlayingInfoCenter`.
- Implement play, pause, seek, skip, and playback-rate remote commands.
- Persist local progress using the stable web-compatible identity.
- Restore the saved position, mark completion, and support autoplay-next.
- Confirm background playback, Control Center, lock screen, Bluetooth controls,
  interruptions, and audio-route changes on a physical device.

### 2. Real History and Saved features

- Replace both placeholder tabs with local persistent stores.
- Keep storage models versioned and migration-safe.
- Make save state available on cards and player screens.
- Provide explicit deletion, clear-all confirmation, and useful empty states.
- Preserve the website's semantics for completed and meaningfully watched items.

### 3. Authentication and cloud sync

- Add Firebase through Swift Package Manager in `project.yml`.
- Support the authentication methods approved for the App Store. If Google
  sign-in is offered, include Sign in with Apple where Apple's rules require it.
- Reproduce the web merge rules documented in the root developer guide: newer
  progress and notes win, completion is sticky, and saved items are unioned.
- Keep guest data isolated and restore it after sign-out.
- Test first sign-in, same-account hydration, account switching, sign-out, and
  deletion on two devices before enabling production writes.

### 4. Notes, streaks, and search parity

- Support the existing markdown-lite note format and timestamp links.
- Keep the fixed 15-minute streak goal and current freeze/rank semantics.
- Add transcript-result search only after title, speaker, topic, and series search
  are reliable and accessible.
- Do not silently change the Firestore document contract from the app.

### 5. Offline downloads

- Use background `URLSession` downloads with explicit state and retry behavior.
- Store media outside iCloud backup and expose per-item and total storage usage.
- Verify free disk space before starting large downloads.
- Define expiration, replacement, and logout behavior before shipping.
- Do not assume every remote media URL is licensed for permanent offline storage;
  confirm distribution rights first.

### 6. Platform and release work

- Add universal links for canonical series and watch URLs.
- Add app icons, launch treatment, privacy manifests, support URLs, screenshots,
  and App Store metadata.
- Add crash reporting and privacy-conscious analytics only after a written data
  policy exists.
- Add push notifications, widgets, Live Activities, and CarPlay only when their
  user value and operational ownership are defined.

## Design and accessibility rules

The app should clearly belong to the same product as the website, but native
interaction takes priority over pixel-for-pixel copying.

- Use semantic colors from `Core/Brand.swift`; do not scatter color literals.
- Keep lecture artwork at 16:9 and speaker portraits circular.
- Retain the calm parchment, green, serif-heading, and restrained-card identity.
- Prefer native navigation bars, tab bars, sheets, menus, controls, and haptics.
- Support light, dark, and increased-contrast appearances.
- Use Dynamic Type styles; avoid fixed heights around text.
- Provide useful labels, values, hints, and traits for custom VoiceOver elements.
- Maintain logical focus order and minimum interactive target sizes.
- Test right-to-left layout, Voice Control, Reduce Motion, and very large text.
- Never rely on color, animation, or an icon alone to communicate state.

Any feature is incomplete until its empty, loading, offline, error, and disabled
states have been considered.

## Player and content safety

- Use native AVFoundation and AVKit media behavior unless a documented product
  requirement cannot be met with them.
- Never log media URLs containing future authorization tokens.
- Do not treat a failed media request as permission to retry indefinitely.
- Preserve caption URLs and learning metadata in the shared catalog contract.
- Islamic editorial metadata comes from maintained repository data; native views
  may format it but should not invent or alter religious claims.

## Validation

Before committing an iOS milestone:

1. Run `npm run check` from the repository root.
2. Run `xcodegen generate` from `ios/`.
3. Build the `ImprovingMuslim` scheme with warnings treated seriously.
4. Run applicable unit and UI tests once those targets exist.
5. Test at least one small iPhone, one current iPhone, and one iPad layout.
6. Test light/dark appearance and at least one accessibility text size.
7. For player changes, test a physical device, backgrounding, lock screen,
   Bluetooth/headphones, interruptions, and a poor network connection.

The path-scoped `.github/workflows/ios.yml` workflow regenerates the Xcode project
and builds the app for an iOS Simulator. It catches compiler and project drift,
but it does not replace device, media-session, accessibility, or App Store tests.

Development performed from Windows can update Swift source and run shared Node
checks, but it cannot be considered natively verified until the macOS CI build
passes. Hardware-dependent player features still require a developer with a Mac
and physical Apple device.

## Testing direction

Add test targets to `project.yml` as the next production slice begins:

- Unit-test catalog decoding, filtering, progress normalization, merge rules,
  duration formatting, and next-item selection.
- Use protocol-backed fakes for network, clock, persistence, player, and account
  behavior.
- Add focused UI tests for launch, offline fallback, search, opening a lecture,
  saving it, resuming playback, and accessibility identifiers.
- Avoid snapshot tests as the only accessibility or layout coverage.

Do not add a test target directly inside a generated Xcode project. Update
`project.yml`, regenerate, and commit the source definition and tests.

## Generated and secret files

Generated; do not hand-edit or commit unless already tracked as an output:

- `ImprovingMuslim.xcodeproj/`
- `ImprovingMuslim/Info.plist`
- `ImprovingMuslim/Resources/catalog.json`
- `../api/v1/catalog.json`

Never commit signing certificates, provisioning profiles, `.p8` keys, Firebase
service-account credentials, App Store Connect keys, private configuration, or
downloaded lecture media. Client configuration that is intentionally public
must still be documented and restricted to the appropriate bundle identifier.

## Git and release workflow

Repository policy requires working directly on `main`:

- Synchronize `main` with `origin/main` before editing.
- Preserve unrelated working-tree changes.
- Keep commits focused.
- Run relevant local checks.
- Fetch again and confirm the push remains fast-forward.
- Push completed work with `git push origin main`.
- Confirm both the normal `Check` workflow and the `iOS` workflow are green.

Do not create feature branches or pull requests for this repository unless the
repository policy is explicitly changed first.

For an App Store release, additionally require a clean Archive build, device
testing, TestFlight validation, completed privacy disclosures, content-rights
review, support/contact readiness, and an explicit release checklist. A green
simulator build alone is not release approval.
