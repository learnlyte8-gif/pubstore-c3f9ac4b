import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { COLORS, IG_GRADIENT } from "../theme";

const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const inter = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const STATS = [
  { num: "10K+", label: "Products" },
  { num: "180+", label: "Countries" },
  { num: "24h", label: "Live drops" },
  { num: "★ 4.9", label: "Buyer rated" },
];

export const ScenePromise: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        color: COLORS.ink,
        fontFamily: inter.fontFamily,
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: COLORS.gold,
          fontWeight: 600,
          opacity: spring({ frame, fps, config: { damping: 200 } }),
          marginBottom: 36,
        }}
      >
        ◆ Built for buyers
      </div>

      <div
        style={{
          fontFamily: anton.fontFamily,
          fontSize: 180,
          lineHeight: 0.9,
          letterSpacing: -2,
          textAlign: "center",
          textTransform: "uppercase",
          maxWidth: 1500,
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: `translateY(${interpolate(
              frame,
              [4, 30],
              [60, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            )}px)`,
            opacity: interpolate(frame, [4, 30], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            }),
          }}
        >
          Source it.
        </span>{" "}
        <span
          style={{
            display: "inline-block",
            transform: `translateY(${interpolate(
              frame,
              [12, 38],
              [60, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            )}px)`,
            opacity: interpolate(frame, [12, 38], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            }),
            background: IG_GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Sell it.
        </span>{" "}
        <span
          style={{
            display: "inline-block",
            transform: `translateY(${interpolate(
              frame,
              [20, 46],
              [60, 0],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            )}px)`,
            opacity: interpolate(frame, [20, 46], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            }),
          }}
        >
          Live it.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 80,
          marginTop: 100,
        }}
      >
        {STATS.map((s, i) => {
          const sp = spring({
            frame: frame - 40 - i * 6,
            fps,
            config: { damping: 14, stiffness: 130 },
          });
          return (
            <div
              key={s.label}
              style={{
                opacity: sp,
                transform: `translateY(${(1 - sp) * 30}px)`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: anton.fontFamily,
                  fontSize: 110,
                  lineHeight: 1,
                  letterSpacing: -1,
                  background: IG_GRADIENT,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 20,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: COLORS.inkDim,
                  fontWeight: 600,
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
