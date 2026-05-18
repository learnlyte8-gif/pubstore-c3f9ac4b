import React from "react";
import { Composition } from "remotion";
import { VerticalAd, TOTAL } from "./VerticalAd";
import { ADS } from "./data";

export const AdsRoot: React.FC = () => (
  <>
    {Object.entries(ADS).map(([key, props]) => (
      <Composition
        key={key}
        id={`ad-${key}`}
        component={VerticalAd}
        durationInFrames={TOTAL}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={props}
      />
    ))}
  </>
);
