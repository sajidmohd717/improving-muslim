import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { Phone, ScrollingScreen } from './Phone';

export const FPS = 30;

const CREAM = '#f7f3ec';
const INK_DARK = '#101714';
const GREEN = '#176b5b';
const GREEN_DEEP = '#0f4f43';
const GOLD = '#c89b3c';
const MUTED = '#aab8b0';

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";

// Scene lengths in frames
const S1 = 105; // hook
const S2 = 210; // home feed scroll
const S3 = 180; // series page
const S4 = 180; // watch page + features
const S5 = 130; // end card
export const PROMO_DURATION = S1 + S2 + S3 + S4 + S5;

const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 90% at 50% 0%, #1d2a25 0%, ${INK_DARK} 55%, #0a0f0c 100%)`,
    }}
  >
    {/* soft green glow behind the device area */}
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '46%',
        width: 1200,
        height: 1200,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${GREEN_DEEP}55 0%, transparent 60%)`,
      }}
    />
  </AbsoluteFill>
);

const fadeInOut = (frame: number, duration: number, inLen = 15, outLen = 15) =>
  interpolate(
    frame,
    [0, inLen, duration - outLen, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

const rise = (frame: number, delay = 0) =>
  interpolate(frame - delay, [0, 22], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

const riseOpacity = (frame: number, delay = 0) =>
  interpolate(frame - delay, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// ---------- Scene 1: hook ----------
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeInOut(frame, S1, 12, 14),
        padding: 90,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 92,
            lineHeight: 1.15,
            color: CREAM,
            opacity: riseOpacity(frame, 4),
            transform: `translateY(${rise(frame, 4)}px)`,
          }}
        >
          The lectures you love.
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 92,
            lineHeight: 1.15,
            color: GOLD,
            marginTop: 18,
            opacity: riseOpacity(frame, 26),
            transform: `translateY(${rise(frame, 26)}px)`,
          }}
        >
          One beautiful place.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: MUTED,
            marginTop: 54,
            opacity: riseOpacity(frame, 48),
          }}
        >
          Menk · Yasir Qadhi · Omar Suleiman
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Phone scenes share this layout ----------
const PhoneScene: React.FC<{
  duration: number;
  caption: string;
  sub?: string;
  rotateYFrom: number;
  rotateYTo: number;
  children: React.ReactNode;
}> = ({ duration, caption, sub, rotateYFrom, rotateYTo, children }) => {
  const frame = useCurrentFrame();
  const rotY = interpolate(frame, [0, duration], [rotateYFrom, rotateYTo], {
    easing: Easing.inOut(Easing.quad),
  });
  const float = Math.sin((frame / FPS) * 1.4) * 8;
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        opacity: fadeInOut(frame, duration),
        paddingTop: 150,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 70, padding: '0 80px' }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 62,
            color: CREAM,
            opacity: riseOpacity(frame, 6),
            transform: `translateY(${rise(frame, 6)}px)`,
          }}
        >
          {caption}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: SANS,
              fontSize: 32,
              color: MUTED,
              marginTop: 20,
              opacity: riseOpacity(frame, 22),
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      <Phone width={640} rotateY={rotY} rotateX={4} translateY={float}>
        {children}
      </Phone>
    </AbsoluteFill>
  );
};

// ---------- Scene 2: home feed scroll ----------
const HomeFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [25, S2 - 15], [0, 2400], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <PhoneScene
      duration={S2}
      caption="A home feed made for lectures"
      sub="No shorts. No clickbait. No algorithm traps."
      rotateYFrom={-16}
      rotateYTo={-4}
    >
      <ScrollingScreen src={staticFile('home.png')} scrollPx={scroll} />
    </PhoneScene>
  );
};

// ---------- Scene 3: series page ----------
const SeriesPage: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [20, S3 - 15], [0, 1500], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <PhoneScene
      duration={S3}
      caption="Every series, in order"
      sub="Numbered, ordered, and ready to binge."
      rotateYFrom={14}
      rotateYTo={3}
    >
      <ScrollingScreen src={staticFile('series-lom.png')} scrollPx={scroll} />
    </PhoneScene>
  );
};

// ---------- Scene 4: watch page + feature chips ----------
const FEATURES = ['Take notes while you watch', 'Captions on every lecture', 'Pick up where you left off'];

const WatchPage: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        opacity: fadeInOut(frame, S4),
        paddingTop: 150,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 62,
            color: CREAM,
            opacity: riseOpacity(frame, 6),
            transform: `translateY(${rise(frame, 6)}px)`,
          }}
        >
          Built for actually learning
        </div>
      </div>
      <Phone
        width={580}
        rotateY={interpolate(frame, [0, S4], [-10, 6], {
          easing: Easing.inOut(Easing.quad),
        })}
        rotateX={4}
        translateY={Math.sin((frame / FPS) * 1.4) * 8}
      >
        <ScrollingScreen src={staticFile('watch-lom.png')} scrollPx={0} />
      </Phone>
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          alignItems: 'center',
        }}
      >
        {FEATURES.map((f, i) => (
          <div
            key={f}
            style={{
              fontFamily: SANS,
              fontSize: 36,
              fontWeight: 600,
              color: CREAM,
              background: `${GREEN}e8`,
              border: `2px solid ${GOLD}55`,
              borderRadius: 999,
              padding: '20px 44px',
              opacity: riseOpacity(frame, 22 + i * 16),
              transform: `translateY(${rise(frame, 22 + i * 16)}px)`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
            }}
          >
            {f}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 5: end card ----------
const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], {
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
            fontSize: 100,
            color: CREAM,
            opacity: riseOpacity(frame, 4),
            transform: `translateY(${rise(frame, 4)}px)`,
          }}
        >
          Improving Muslim
        </div>
        <div
          style={{
            width: 140,
            height: 4,
            background: GOLD,
            margin: '44px auto',
            opacity: riseOpacity(frame, 20),
          }}
        />
        <div
          style={{
            fontFamily: SANS,
            fontSize: 44,
            color: MUTED,
            opacity: riseOpacity(frame, 28),
          }}
        >
          Free. No ads. No distractions.
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 52,
            fontWeight: 700,
            color: GOLD,
            marginTop: 60,
            opacity: riseOpacity(frame, 44),
            transform: `translateY(${rise(frame, 44)}px)`,
          }}
        >
          improvingmuslim.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={S1}>
        <Hook />
      </Sequence>
      <Sequence from={S1} durationInFrames={S2}>
        <HomeFeed />
      </Sequence>
      <Sequence from={S1 + S2} durationInFrames={S3}>
        <SeriesPage />
      </Sequence>
      <Sequence from={S1 + S2 + S3} durationInFrames={S4}>
        <WatchPage />
      </Sequence>
      <Sequence from={S1 + S2 + S3 + S4} durationInFrames={S5}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
