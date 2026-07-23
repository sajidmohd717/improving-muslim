import React from 'react';
import { Composition } from 'remotion';
import { Promo, PROMO_DURATION, FPS } from './Promo';
import { PromoV2, PROMO_V2_DURATION } from './PromoV2';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Promo"
        component={Promo}
        durationInFrames={PROMO_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="PromoV2"
        component={PromoV2}
        durationInFrames={PROMO_V2_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* Same composition as V2, rendered at 60fps for smoother scrolling */}
      <Composition
        id="PromoV3"
        component={PromoV2}
        durationInFrames={PROMO_V2_DURATION * 2}
        fps={60}
        width={1080}
        height={1920}
      />
    </>
  );
};
