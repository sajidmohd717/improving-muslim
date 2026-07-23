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
import { loadFont as loadInriaSerif } from '@remotion/google-fonts/InriaSerif';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { Phone, ScrollingScreen, SCREEN_W } from './Phone';

// Brand fonts (same as all other marketing assets): Inria Serif 700 for
// headings, Inter for body. Bolder even strokes render crisper than the
// old Georgia stand-in.
const inriaSerif = loadInriaSerif('normal', { weights: ['700'] });
const inter = loadInter('normal', { weights: ['400', '600', '700'] });

// All timings below are authored in frames at this base rate. Components
// scale them by (fps / BASE_FPS), so the same composition can be registered
// at 30fps (PromoV2) or 60fps (PromoV3) with identical real-time pacing.
export const BASE_FPS = 30;

// Light-mode palette (site light theme)
const CREAM = '#f7f3ec';
const CREAM_DEEP = '#ece3d2';
const INK = '#18201b';
const GREEN = '#176b5b';
const GREEN_DEEP = '#0f4f43';
const GOLD = '#c89b3c';
const MUTED = '#66706a';

const SERIF = `${inriaSerif.fontFamily}, Georgia, serif`;
const SANS = `${inter.fontFamily}, 'Segoe UI', Arial, sans-serif`;
const SERIF_WEIGHT = 700;

// Scene lengths in frames at BASE_FPS
const S1 = 120; // hook
const S2 = 210; // home feed scroll
const S3 = 180; // series page
const S4 = 180; // watch page + features
const S5 = 130; // end card
const TOTAL = S1 + S2 + S3 + S4 + S5;

// Duration at BASE_FPS (30). For other rates: PROMO_V2_DURATION * fps / 30.
export const PROMO_V2_DURATION = TOTAL;

const useTimeScale = () => useVideoConfig().fps / BASE_FPS;

const SPEAKERS = [
  { name: 'Mufti Menk', img: 'speaker-mufti-menk.jpg' },
  { name: 'Omar Suleiman', img: 'speaker-omar-suleiman.jpg' },
  { name: 'Ali Hammuda', img: 'speaker-ali-hammuda.jpg' },
  { name: 'Navaid Aziz', img: 'speaker-navaid-aziz.jpg' },
];

const Background: React.FC = () => (
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

// k = fps / BASE_FPS; frame is in real composition frames, all other
// arguments are authored at BASE_FPS.
const fadeInOut = (
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
const rise = (frame: number, delay: number, k: number) =>
  Math.round(
    interpolate(frame - delay * k, [0, 22 * k], [40, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })
  );

const riseOpacity = (frame: number, delay: number, k: number) =>
  interpolate(frame - delay * k, [0, 18 * k], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// ---------- iOS status bar (drawn inside the phone screen) ----------
export const STATUS_BAR_H = 48;

const StatusBar: React.FC = () => (
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
const DeviceScreen: React.FC<{ src: string; scrollPx: number }> = ({
  src,
  scrollPx,
}) => (
  <>
    <StatusBar />
    <div style={{ position: 'absolute', top: STATUS_BAR_H, left: 0 }}>
      <ScrollingScreen src={src} scrollPx={scrollPx} />
    </div>
  </>
);

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
