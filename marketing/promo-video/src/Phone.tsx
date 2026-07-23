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
          boxShadow:
            '0 80px 120px rgba(0,0,0,0.55), 0 30px 50px rgba(0,0,0,0.4), inset 0 0 4px rgba(255,255,255,0.25)',
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
