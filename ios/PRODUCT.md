# iOS product foundation

## Product promise

Improving Muslim is a calm place to discover, study, and return to trustworthy
Islamic lectures. The app prioritizes learning continuity over engagement noise.

## Visual translation

The web experience is the source of the product identity. SwiftUI uses the same
semantic palette and content hierarchy while adopting native navigation,
accessibility, motion, and media conventions.

| Role | Light | Dark | Native use |
|---|---|---|---|
| Background | `#F7F3EC` | `#101714` | Screen canvas |
| Surface | `#FFFDF8` | `#17211D` | Cards and grouped content |
| Strong surface | `#FFFFFF` | `#1D2A25` | Elevated controls |
| Ink | `#18201B` | `#EEF4ED` | Primary text |
| Muted | `#66706A` | `#AAB8B0` | Secondary text |
| Accent | `#176B5B` | `#6CC4AD` | Selection and primary actions |
| Gold | `#C89B3C` | `#D7B45C` | Restrained highlights |
| Rose | `#A6484F` | `#E08C94` | Destructive and attention states |

Editorial headings use a serif system face until the product font files are
licensed and bundled; controls and body copy use the native sans-serif face so
Dynamic Type remains reliable. Lecture art stays 16:9, topic filters are pills,
and card corners remain deliberately restrained rather than overly rounded.

## Navigation

The first app shell mirrors the web mobile destinations: Home, Explore, History,
Saved, and Speakers. Lecture detail and playback are pushed within the current
navigation stack so returning to discovery preserves context.

## Accessibility baseline

- Every actionable lecture card has one concise VoiceOver label and hint.
- Text uses Dynamic Type and layouts may grow vertically without truncating
  essential information.
- Meaning is never conveyed by color alone.
- Reduce Motion, increased contrast, Voice Control, and right-to-left layouts
  are release checks, not later enhancements.
- Tap targets use the native minimum size and media controls remain native.

## Delivery slices

1. Shared catalog contract and recognizable SwiftUI discovery shell.
2. Production player: progress, Media Player metadata, remote commands, captions,
   autoplay-next, and interruption handling.
3. Firebase authentication and deterministic merge-compatible account sync.
4. Saved items, history, notes, streaks, and search parity.
5. Protected offline downloads, background transfer, and storage management.
6. Deep links, notifications, widgets, App Store production hardening, and
   eventually CarPlay where the audio experience meets Apple's requirements.
