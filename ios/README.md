# Improving Muslim for iOS

The native SwiftUI client shares the web platform's catalog and visual identity.
The maintained lecture data remains in the repository's `data/` directory;
`npm run generate:content` publishes it as `api/v1/catalog.json` and refreshes
the bundled offline catalog used by the app.

## Open the project on macOS

1. Install Xcode 16 or newer and [XcodeGen](https://github.com/yonaskolb/XcodeGen).
2. From this directory, run `xcodegen generate`.
3. Open `ImprovingMuslim.xcodeproj`, select a development team, and run the
   `ImprovingMuslim` scheme on an iOS 17+ simulator or device.

Do not edit the bundled `ImprovingMuslim/Resources/catalog.json` by hand. It is
generated alongside the public API from the web catalog.

## First-release boundary

The initial foundation includes native discovery, topic filtering, speaker
browsing, a bundled offline catalog fallback, and AVKit playback with background
audio entitlement. Account sync, downloads, notes, progress persistence, and
lock-screen metadata are intentionally the next vertical slices.
