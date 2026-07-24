// Promo video #2 — feature: My Notes.
// Every screen here is a real capture of the notes editor being used (see
// capture-notes.cjs), including the typing, so the video shows the product
// rather than a mock of it.
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Phone } from './Phone';
import {
  Background,
  CREAM,
  DeviceScreen,
  GOLD,
  GREEN,
  GREEN_DEEP,
  INK,
  MUTED,
  SANS,
  SERIF,
  SERIF_WEIGHT,

  fadeInOut,
  rise,
  riseOpacity,
  useTimeScale,
} from './shared';
import manifest from '../public/notes-manifest.json';

// Scene lengths in frames at BASE_FPS (30)
const S1 = 110; // hook
const S2 = 300; // write the note
const S3 = 240; // tap the timestamp, jump back
const S4 = 130; // end card
const TOTAL = S1 + S2 + S3 + S4;

// Duration at BASE_FPS. For other rates: PROMO_NOTES_DURATION * fps / 30.
export const PROMO_NOTES_DURATION = TOTAL;

const PHONE_W = 620;

// Where the rendered timestamp chip sits, in the captured screenshot's own
// coordinates. Rendered as a DeviceScreen `overlay`, which is anchored to the
// screenshot, so these need no adjustment for the mockup's status bar.
const CHIP_X = manifest.chip.x;
const CHIP_Y = manifest.chip.y;

const typingFrame = (i: number) =>
  staticFile(`notes-type-${String(i).padStart(3, '0')}.png`);

/* ── Shared scene chrome ───────────────────────────────────────────────── */

const Caption: React.FC<{
  frame: number;
  k: number;
  title: string;
  sub?: string;
}> = ({ frame, k, title, sub }) => (
  <div style={{ textAlign: 'center', marginBottom: 54, padding: '0 70px' }}>
    <div
      style={{
        fontFamily: SERIF,
        fontWeight: SERIF_WEIGHT,
        fontSize: 62,
        lineHeight: 1.2,
        color: INK,
        opacity: riseOpacity(frame, 6, k),
        transform: `translateY(${rise(frame, 6, k)}px)`,
      }}
    >
      {title}
    </div>
    {sub ? (
      <div
        style={{
          fontFamily: SANS,
          fontSize: 32,
          color: MUTED,
          marginTop: 18,
          opacity: riseOpacity(frame, 22, k),
        }}
      >
        {sub}
      </div>
    ) : null}
  </div>
);

const PhoneStage: React.FC<{
  duration: number;
  rotateY: number;
  children: React.ReactNode;
}> = ({ duration, rotateY, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const float = Math.sin((frame / fps) * 1.4) * 7;
  return (
    <Phone width={PHONE_W} rotateY={rotateY} rotateX={4} translateY={float}>
      {children}
    </Phone>
  );
};

/* ── Scene 1: hook ─────────────────────────────────────────────────────── */

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useTimeScale();
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeInOut(frame, S1, k, 12, 14),
        padding: 90,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 88,
            lineHeight: 1.18,
            color: INK,
            opacity: riseOpacity(frame, 4, k),
            transform: `translateY(${rise(frame, 4, k)}px)`,
          }}
        >
          You’ll hear something
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 88,
            lineHeight: 1.18,
            color: GREEN,
            marginTop: 14,
            opacity: riseOpacity(frame, 24, k),
            transform: `translateY(${rise(frame, 24, k)}px)`,
          }}
        >
          you don’t want to forget.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            color: MUTED,
            marginTop: 46,
            opacity: riseOpacity(frame, 52, k),
          }}
        >
          So don’t rely on remembering it.
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 2: write the note ───────────────────────────────────────────── */

const WriteNote: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useTimeScale();
  const f = frame / k; // back to BASE_FPS frames for step timing

  const n = manifest.typingFrames;
  const TYPE_START = 70;
  const TYPE_END = 250;
  const perStep = (TYPE_END - TYPE_START) / n;

  let src: string;
  if (f < 45) src = staticFile('notes-01-open.png');
  else if (f < TYPE_START) src = staticFile('notes-02-timestamp.png');
  else if (f < TYPE_END) {
    const i = Math.min(n - 1, Math.floor((f - TYPE_START) / perStep));
    src = typingFrame(i);
  } else src = staticFile('notes-03-saved.png');

  const rotY = interpolate(frame, [0, S2 * k], [-12, -2], {
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        opacity: fadeInOut(frame, S2, k),
        paddingTop: 140,
      }}
    >
      <Caption
        frame={frame}
        k={k}
        title="Write it down as you listen"
        sub="Without ever leaving the lecture."
      />
      <PhoneStage duration={S2} rotateY={rotY}>
        <DeviceScreen src={src} scrollPx={0} />
      </PhoneStage>
    </AbsoluteFill>
  );
};

/* ── Scene 3: tap the timestamp, jump back ─────────────────────────────── */

const TapRipple: React.FC<{ progress: number }> = ({ progress }) => {
  const scale = interpolate(progress, [0, 1], [0.35, 2.4]);
  const opacity = interpolate(progress, [0, 0.25, 1], [0, 0.55, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: CHIP_X,
        top: CHIP_Y,
        width: 76,
        height: 76,
        marginLeft: -38,
        marginTop: -38,
        borderRadius: '50%',
        border: `3px solid ${GREEN}`,
        background: `${GREEN}22`,
        transform: `scale(${scale})`,
        opacity,
        zIndex: 5,
      }}
    />
  );
};

const JumpBack: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useTimeScale();
  const f = frame / k;

  const TAP_AT = 95;
  const CUT_AT = 130;
  const tapped = f >= CUT_AT;
  const src = tapped
    ? staticFile('notes-06-seeked.png')
    : staticFile('notes-05-later.png');

  const rippleProgress = interpolate(f, [TAP_AT, TAP_AT + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        opacity: fadeInOut(frame, S3, k),
        paddingTop: 140,
      }}
    >
      <Caption
        frame={frame}
        k={k}
        title="Tap the time. Go straight back."
        sub="Every timestamp you write becomes a way in."
      />
      <PhoneStage duration={S3} rotateY={4}>
        <DeviceScreen
          src={src}
          scrollPx={0}
          overlay={
            !tapped && rippleProgress > 0 ? (
              <TapRipple progress={rippleProgress} />
            ) : null
          }
        />
      </PhoneStage>

      {/* Make the jump unmissable — the player time is small on screen */}
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          fontFamily: SANS,
          fontSize: 44,
          fontWeight: 700,
          opacity: riseOpacity(frame, CUT_AT + 6, k),
          transform: `translateY(${rise(frame, CUT_AT + 6, k)}px)`,
        }}
      >
        <span
          style={{
            color: MUTED,
            textDecoration: 'line-through',
            textDecorationThickness: 3,
          }}
        >
          38:20
        </span>
        <span style={{ color: GOLD, fontSize: 40 }}>→</span>
        <span
          style={{
            color: CREAM,
            background: GREEN,
            borderRadius: 999,
            padding: '14px 34px',
            boxShadow: '0 16px 32px rgba(24,32,27,0.22)',
          }}
        >
          12:45
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 4: end card ─────────────────────────────────────────────────── */

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useTimeScale();
  const opacity = interpolate(frame, [0, 18 * k], [0, 1], {
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', opacity }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 58,
            color: MUTED,
            opacity: riseOpacity(frame, 2, k),
          }}
        >
          Notes that stay with the lecture
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 100,
            color: INK,
            marginTop: 26,
            opacity: riseOpacity(frame, 16, k),
            transform: `translateY(${rise(frame, 16, k)}px)`,
          }}
        >
          Improving Muslim
        </div>
        <div
          style={{
            width: 140,
            height: 4,
            background: GOLD,
            margin: '40px auto',
            opacity: riseOpacity(frame, 30, k),
          }}
        />
        <div
          style={{
            fontFamily: SANS,
            fontSize: 44,
            color: MUTED,
            opacity: riseOpacity(frame, 36, k),
          }}
        >
          Free. No ads. No distractions.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 52,
            fontWeight: 700,
            color: GREEN_DEEP,
            marginTop: 54,
            opacity: riseOpacity(frame, 50, k),
            transform: `translateY(${rise(frame, 50, k)}px)`,
          }}
        >
          improvingmuslim.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PromoNotes: React.FC = () => {
  const k = useTimeScale();
  const at = (n: number) => Math.round(n * k);
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={at(S1)}>
        <Hook />
      </Sequence>
      <Sequence from={at(S1)} durationInFrames={at(S2)}>
        <WriteNote />
      </Sequence>
      <Sequence from={at(S1 + S2)} durationInFrames={at(S3)}>
        <JumpBack />
      </Sequence>
      <Sequence from={at(S1 + S2 + S3)} durationInFrames={at(S4)}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
