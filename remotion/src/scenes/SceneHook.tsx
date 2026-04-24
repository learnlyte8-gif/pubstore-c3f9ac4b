import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Img,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { COLORS, IG_GRADIENT } from "../theme";

const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const inter = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrow = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const titleClip = interpolate(frame, [10, 38], [0, 100], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const titleY = interpolate(frame, [10, 38], [40, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const sub = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const lineGrow = interpolate(frame, [22, 60], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        padding: "120px 140px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: inter.fontFamily,
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          opacity: eyebrow,
          transform: `translateX(${(1 - eyebrow) * -20}px)`,
          letterSpacing: 8,
          fontSize: 22,
          fontWeight: 600,
          color: COLORS.gold,
          textTransform: "uppercase",
          marginBottom: 32,
        }}
      >
        ◆ Wholesale, reimagined
      </div>

      <div
        style={{
          fontFamily: anton.fontFamily,
          fontSize: 280,
          lineHeight: 0.9,
          letterSpacing: -4,
          textTransform: "uppercase",
          overflow: "hidden",
          height: 260,
        }}
      >
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            clipPath: `inset(0 ${100 - titleClip}% 0 0)`,
          }}
        >
          The world's
        </div>
      </div>
      <div
        style={{
          fontFamily: anton.fontFamily,
          fontSize: 280,
          lineHeight: 0.9,
          letterSpacing: -4,
          textTransform: "uppercase",
          overflow: "hidden",
          height: 260,
        }}
      >
        <div
          style={{
            transform: `translateY(${interpolate(
              frame,
              [18, 46],
              [40, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            )}px)`,
            clipPath: `inset(0 ${100 - interpolate(
              frame,
              [18, 46],
              [0, 100],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            )}% 0 0)`,
            background: IG_GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          marketplace.
        </div>
      </div>

      <div
        style={{
          marginTop: 48,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            height: 2,
            width: lineGrow * 220,
            background: COLORS.ink,
          }}
        />
        <div
          style={{
            opacity: sub,
            transform: `translateY(${(1 - sub) * 12}px)`,
            fontSize: 28,
            fontWeight: 400,
            color: COLORS.inkDim,
            maxWidth: 720,
          }}
        >
          Verified suppliers. Live drops. Shipped worldwide.
        </div>
      </div>
    </AbsoluteFill>
  );
};
