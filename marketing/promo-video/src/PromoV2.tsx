import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Phone } from './Phone';
import {
  BASE_FPS,
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

// Scene lengths in frames at BASE_FPS
const S1 = 120; // hook
const S2 = 210; // home feed scroll
const S3 = 180; // series page
const S4 = 180; // watch page + features
const S5 = 130; // end card
const TOTAL = S1 + S2 + S3 + S4 + S5;

// Duration at BASE_FPS (30). For other rates: PROMO_V2_DURATION * fps / 30.
export const PROMO_V2_DURATION = TOTAL;

const SPEAKERS = [
  { name: 'Mufti Menk', img: 'speaker-mufti-menk.jpg' },
  { name: 'Omar Suleiman', img: 'speaker-omar-suleiman.jpg' },
  { name: 'Ali Hammuda', img: 'speaker-ali-hammuda.jpg' },
  { name: 'Navaid Aziz', img: 'speaker-navaid-aziz.jpg' },
];

// ---------- Scene 1: hook with speaker avatars ----------
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = useTimeScale();
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeInOut(frame, S1, k, 12, 14),
        padding: 80,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 92,
            lineHeight: 1.15,
            color: INK,
            opacity: riseOpacity(frame, 4, k),
            transform: `translateY(${rise(frame, 4, k)}px)`,
          }}
        >
          The lectures you love.
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 92,
            lineHeight: 1.15,
            color: GREEN,
            marginTop: 18,
            opacity: riseOpacity(frame, 26, k),
            transform: `translateY(${rise(frame, 26, k)}px)`,
          }}
        >
          One beautiful place.
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 44,
            marginTop: 90,
          }}
        >
          {SPEAKERS.map((s, i) => {
            const pop = spring({
              frame: frame - (48 + i * 8) * k,
              fps,
              config: { damping: 12, mass: 0.6 },
            });
            return (
              <div key={s.name} style={{ transform: `scale(${pop})` }}>
                <Img
                  src={staticFile(s.img)}
                  style={{
                    width: 172,
                    height: 172,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `5px solid ${GOLD}`,
                    boxShadow: '0 24px 44px rgba(24,32,27,0.28)',
                  }}
                />
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: 24,
                    fontWeight: 600,
                    color: MUTED,
                    marginTop: 20,
                    textAlign: 'center',
                  }}
                >
                  {s.name}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 30,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: GOLD,
            marginTop: 70,
            opacity: riseOpacity(frame, 84, k),
          }}
        >
          and many more
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Shared phone-scene layout ----------
const PhoneScene: React.FC<{
  duration: number; // in BASE_FPS frames
  caption: string;
  sub?: string;
  rotateYFrom: number;
  rotateYTo: number;
  children: React.ReactNode;
}> = ({ duration, caption, sub, rotateYFrom, rotateYTo, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = useTimeScale();
  const rotY = interpolate(frame, [0, duration * k], [rotateYFrom, rotateYTo], {
    easing: Easing.inOut(Easing.quad),
  });
  const float = Math.sin((frame / fps) * 1.4) * 8;
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        opacity: fadeInOut(frame, duration, k),
        paddingTop: 150,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 70, padding: '0 80px' }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 62,
            color: INK,
            opacity: riseOpacity(frame, 6, k),
            transform: `translateY(${rise(frame, 6, k)}px)`,
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
              opacity: riseOpacity(frame, 22, k),
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

// ---------- Scene 2: home feed ----------
const HomeFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useTimeScale();
  const scroll = interpolate(frame, [25 * k, (S2 - 15) * k], [0, 2400], {
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
      <DeviceScreen src={staticFile('home.png')} scrollPx={scroll} />
    </PhoneScene>
  );
};

// ---------- Scene 3: series page ----------
const SeriesPage: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useTimeScale();
  const scroll = interpolate(frame, [20 * k, (S3 - 15) * k], [0, 1500], {
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
      <DeviceScreen src={staticFile('series-lom.png')} scrollPx={scroll} />
    </PhoneScene>
  );
};

// ---------- Scene 4: watch page + feature chips ----------
const FEATURES = [
  'Take notes while you watch',
  'Captions on every lecture',
  'Pick up where you left off',
];

const WatchPage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = useTimeScale();
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        opacity: fadeInOut(frame, S4, k),
        paddingTop: 150,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: SERIF_WEIGHT,
            fontSize: 62,
            color: INK,
            opacity: riseOpacity(frame, 6, k),
            transform: `translateY(${rise(frame, 6, k)}px)`,
          }}
        >
          Built for actually learning
        </div>
      </div>
      <Phone
        width={580}
        rotateY={interpolate(frame, [0, S4 * k], [-10, 6], {
          easing: Easing.inOut(Easing.quad),
        })}
        rotateX={4}
        translateY={Math.sin((frame / fps) * 1.4) * 8}
      >
        <DeviceScreen src={staticFile('watch-lom.png')} scrollPx={0} />
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
              background: GREEN,
              border: `2px solid ${GOLD}88`,
              borderRadius: 999,
              padding: '20px 44px',
              opacity: riseOpacity(frame, 22 + i * 16, k),
              transform: `translateY(${rise(frame, 22 + i * 16, k)}px)`,
              boxShadow: '0 20px 40px rgba(24,32,27,0.25)',
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
            fontSize: 100,
            color: INK,
            opacity: riseOpacity(frame, 4, k),
            transform: `translateY(${rise(frame, 4, k)}px)`,
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
            opacity: riseOpacity(frame, 20, k),
          }}
        />
        <div
          style={{
            fontFamily: SANS,
            fontSize: 44,
            color: MUTED,
            opacity: riseOpacity(frame, 28, k),
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
            marginTop: 60,
            opacity: riseOpacity(frame, 44, k),
            transform: `translateY(${rise(frame, 44, k)}px)`,
          }}
        >
          improvingmuslim.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PromoV2: React.FC = () => {
  const k = useTimeScale();
  const at = (n: number) => Math.round(n * k);
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={at(S1)}>
        <Hook />
      </Sequence>
      <Sequence from={at(S1)} durationInFrames={at(S2)}>
        <HomeFeed />
      </Sequence>
      <Sequence from={at(S1 + S2)} durationInFrames={at(S3)}>
        <SeriesPage />
      </Sequence>
      <Sequence from={at(S1 + S2 + S3)} durationInFrames={at(S4)}>
        <WatchPage />
      </Sequence>
      <Sequence from={at(S1 + S2 + S3 + S4)} durationInFrames={at(S5)}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
