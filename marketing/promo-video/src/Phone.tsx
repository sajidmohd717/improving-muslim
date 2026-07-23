import React from 'react';
import { Img } from 'remotion';

// iPhone-style device mockup. Screen basis is 375x812 (iPhone 13 Pro CSS px),
// matching the capture viewport, then scaled up via `width`.
export const SCREEN_W = 375;
export const SCREEN_H = 812;
const BEZEL = 14;
const RADIUS = 56;

export const Phone: React.FC<{
  width: number;
  rotateY?: number;
  rotateX?: number;
  translateY?: number;
  children: React.ReactNode;
}> = ({ width, rotateY = 0, rotateX = 0, translateY = 0, children }) => {
  const scale = width / (SCREEN_W + BEZEL * 2);
  // composition px -> pre-scale px, so scaling doesn't multiply the value
  const px = (n: number) => `${n / scale}px`;
  // Layout box matches the scaled visual size so the phone doesn't overlap
  // surrounding flow content; scaling grows downward from the top.
  return (
    <div
      style={{
        perspective: 2400,
        transform: `translateY(${translateY}px)`,
        width,
        height: (SCREEN_H + BEZEL * 2) * scale,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: SCREEN_W + BEZEL * 2,
          height: SCREEN_H + BEZEL * 2,
          flexShrink: 0,
          transform: `scale(${scale}) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
          transformStyle: 'preserve-3d',
          transformOrigin: 'top center',
          background: 'linear-gradient(145deg, #3a3f3d, #141816 45%, #2c302e)',
          borderRadius: RADIUS + BEZEL,
          // Shadow lengths are authored in final-composition pixels and
          // divided by `scale`, because this element is scaled: a raw 120px
          // blur here becomes ~380px once the scale transform and a 2x render
          // multiply it, and Chrome tiles blurs that large — the seams show up
          // as rectangular banding. Dividing keeps the rendered blur fixed and
          // makes the shadow identical at any `width`.
          boxShadow: [
            `0 ${px(26)} ${px(52)} rgba(24,32,27,0.22)`,
            `0 ${px(9)} ${px(18)} rgba(24,32,27,0.16)`,
            `inset 0 0 ${px(3)} rgba(255,255,255,0.25)`,
          ].join(', '),
          padding: BEZEL,
        }}
      >
        <div
          style={{
            width: SCREEN_W,
            height: SCREEN_H,
            borderRadius: RADIUS,
            overflow: 'hidden',
            position: 'relative',
            background: '#f7f3ec',
          }}
        >
          {children}
          {/* dynamic island */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 118,
              height: 34,
              borderRadius: 20,
              background: '#0a0d0b',
              zIndex: 3,
            }}
          />
          {/* glass reflection */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: RADIUS,
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 28%, rgba(255,255,255,0) 45%)',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Screenshot that scrolls vertically inside the phone screen.
// `imgH` is the image height in screen-basis px (raw px / deviceScaleFactor).
export const ScrollingScreen: React.FC<{
  src: string;
  scrollPx: number;
}> = ({ src, scrollPx }) => {
  return (
    <Img
      src={src}
      style={{
        width: SCREEN_W,
        display: 'block',
        transform: `translateY(${-scrollPx}px)`,
      }}
    />
  );
};
