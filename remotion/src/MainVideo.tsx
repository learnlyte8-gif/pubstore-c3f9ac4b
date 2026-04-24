import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { COLORS } from "./theme";
import { PersistentBackdrop } from "./components/PersistentBackdrop";
import { GrainOverlay } from "./components/GrainOverlay";
import { SceneHook } from "./scenes/SceneHook";
import { SceneWall } from "./scenes/SceneWall";
import { SceneFeature } from "./scenes/SceneFeature";
import { ScenePromise } from "./scenes/ScenePromise";
import { SceneEnd } from "./scenes/SceneEnd";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const HOOK = 75;
const WALL = 90;
const FEAT_1 = 105;
const FEAT_2 = 105;
const FEAT_3 = 105;
const PROMISE = 105;
const END = 120;
const T = 18; // transition overlap

// total = sum - (transitions * overlap_count)
export const TOTAL_FRAMES =
  HOOK + WALL + FEAT_1 + FEAT_2 + FEAT_3 + PROMISE + END - T * 6;

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg, overflow: "hidden" }}>
      <PersistentBackdrop />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK}>
          <SceneHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={WALL}>
          <SceneWall />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={FEAT_1}>
          <SceneFeature
            image="products/p3.jpg"
            eyebrow="01 — Footwear"
            title="ICONIC BOOTS"
            price="$117"
            originalPrice="$189"
            tag="Free shipping"
            accent="#F5C242"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={FEAT_2}>
          <SceneFeature
            image="products/p1.jpg"
            eyebrow="02 — Jewelry"
            title="GOLD & PEARL"
            price="$28.60"
            originalPrice="$42"
            tag="Limited drop"
            accent="#DC2A74"
            mirror
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={FEAT_3}>
          <SceneFeature
            image="products/p6.jpg"
            eyebrow="03 — Apparel"
            title="HEAVYWEIGHT"
            price="$12.80"
            originalPrice="$24"
            tag="OEM custom"
            accent="#962FBF"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={PROMISE}>
          <ScenePromise />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={END}>
          <SceneEnd />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <GrainOverlay />
    </AbsoluteFill>
  );
};
