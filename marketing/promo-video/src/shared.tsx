// Scaffolding shared by every promo video: brand palette and fonts, the
// fps-independent timing helpers, the background, and the phone screen
// contents. Each video file holds only its own scenes and copy.
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useVideoConfig,
} from 'remotion';
import { loadFont as loadInriaSerif } from '@remotion/google-fonts/InriaSerif';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { ScrollingScreen, SCREEN_W } from './Phone';

// Brand fonts (same as all other marketing assets): Inria Serif 700 for
// headings, Inter for body. Bolder even strokes render crisper than a
// system-serif stand-in — see the crispness checklist in the README.
const inriaSerif = loadInriaSerif('normal', { weights: ['700'] });
const inter = loadInter('normal', { weights: ['400', '600', '700'] });

export const SERIF = `${inriaSerif.fontFamily}, Georgia, serif`;
export const SANS = `${inter.fontFamily}, 'Segoe UI', Arial, sans-serif`;
export const SERIF_WEIGHT = 700;

// Light-mode palette (site light theme)
export const CREAM = '#f7f3ec';
export const CREAM_DEEP = '#ece3d2';
export const INK = '#18201b';
export const GREEN = '#176b5b';
export const GREEN_DEEP = '#0f4f43';
export const GOLD = '#c89b3c';
export const MUTED = '#66706a';

// Timings are authored in frames at this base rate; components scale them by
// (fps / BASE_FPS), so one composition can be registered at 30fps or 60fps
// with identical real-time pacing.
export const BASE_FPS = 30;
export const useTimeScale = () => useVideoConfig().fps / BASE_FPS;

// k = fps / BASE_FPS; `frame` is in real composition frames, every other
// argument is authored at BASE_FPS.
export const fadeInOut = (
  frame: number,
  duration: number,
  k: number,
  inLen = 15,
  outLen = 15
) =>
  interpolate(
    frame,
    [0, inLen * k, (duration - outLen) * k, duration * k],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

// Math.round keeps moving text on whole pixels — fractional offsets make
// Chrome smear glyphs across pixel boundaries for the whole animation.
export const rise = (frame: number, delay: number, k: number) =>
  Math.round(
    interpolate(frame - delay * k, [0, 22 * k], [40, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );

export const riseOpacity = (frame: number, delay: number, k: number) =>
  interpolate(frame - delay * k, [0, 18 * k], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(170deg, ${CREAM} 0%, ${CREAM_DEEP} 60%, #e2d6bf 100%)`,
    }}
  >
    {/* soft green + gold glows for warmth */}
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '44%',
        width: 1300,
        height: 1300,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${GREEN}1f 0%, transparent 62%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '-10%',
        top: '-8%',
        width: 900,
        height: 900,
        background: `radial-gradient(circle, ${GOLD}2e 0%, transparent 60%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: '-15%',
        bottom: '-10%',
        width: 1000,
        height: 1000,
        background: `radial-gradient(circle, ${GOLD}24 0%, transparent 60%)`,
      }}
    />
  </AbsoluteFill>
);

/* ── iOS status bar, drawn inside the phone screen ─────────────────────── */

export const STATUS_BAR_H = 48;

export const StatusBar: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: SCREEN_W,
      height: STATUS_BAR_H,
      background: CREAM,
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px 0 32px',
      fontFamily: SANS,
    }}
  >
    <div style={{ fontSize: 16, fontWeight: 700, color: INK, letterSpacing: 0.3 }}>
      9:41
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {/* signal bars */}
      <svg width="18" height="12" viewBox="0 0 18 12">
        <rect x="0" y="8" width="3" height="4" rx="1" fill={INK} />
        <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill={INK} />
        <rect x="10" y="3" width="3" height="9" rx="1" fill={INK} />
        <rect x="15" y="0" width="3" height="12" rx="1" fill={INK} />
      </svg>
      {/* wifi */}
      <svg width="17" height="12" viewBox="0 0 17 12">
        <path
          d="M8.5 12 L11.4 8.6 A4.6 4.6 0 0 0 5.6 8.6 Z M13.4 6.2 A7.6 7.6 0 0 0 3.6 6.2 L1.6 3.8 A10.8 10.8 0 0 1 15.4 3.8 Z"
          fill={INK}
        />
      </svg>
      {/* battery */}
      <svg width="27" height="13" viewBox="0 0 27 13">
        <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke={INK} strokeOpacity="0.4" />
        <rect x="2" y="2" width="17" height="9" rx="2" fill={INK} />
        <path d="M25 4.5 A2.2 2.2 0 0 1 25 8.5 Z" fill={INK} fillOpacity="0.4" />
      </svg>
    </div>
  </div>
);

// Screen content: status bar on top, site screenshot below it.
// `overlay` is positioned against the screenshot's own top-left, so anything
// placed with coordinates measured in the browser (see capture scripts) lines
// up without hand-computed status-bar offsets.
export const DeviceScreen: React.FC<{
  src: string;
  scrollPx: number;
  overlay?: React.ReactNode;
}> = ({ src, scrollPx, overlay }) => (
  <>
    <StatusBar />
    <div
      style={{
        position: 'absolute',
        top: STATUS_BAR_H,
        left: 0,
        width: SCREEN_W,
      }}
    >
      <ScrollingScreen src={src} scrollPx={scrollPx} />
      {overlay}
    </div>
  </>
);
