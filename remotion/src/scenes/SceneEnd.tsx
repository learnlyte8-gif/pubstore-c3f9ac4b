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

export const SceneEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ringScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 90 },
  });
  const logoIn = spring({
    frame: frame - 14,
    fps,
    config: { damping: 200 },
  });
  const subIn = spring({ frame: frame - 32, fps, config: { damping: 200 } });
  const ctaIn = spring({ frame: frame - 50, fps, config: { damping: 14 } });
  const url = spring({ frame: frame - 70, fps, config: { damping: 200 } });

  // subtle pulse on cta
  const pulse = 1 + Math.sin(frame / 8) * 0.012;

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
      {/* IG-gradient ring around logo */}
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: IG_GRADIENT,
          padding: 6,
          transform: `scale(${ringScale})`,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: COLORS.bg,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: anton.fontFamily,
            fontSize: 100,
            letterSpacing: -2,
            background: "#0A0A0A",
          }}
        >
          <span
            style={{
              background: IG_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            P
          </span>
        </div>
      </div>

      <div
        style={{
          fontFamily: anton.fontFamily,
          fontSize: 200,
          lineHeight: 0.9,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: logoIn,
          transform: `translateY(${(1 - logoIn) * 24}px) scale(${
            0.96 + logoIn * 0.04
          })`,
        }}
      >
        PUBSTORE
      </div>

      <div
        style={{
          marginTop: 28,
          fontSize: 28,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: COLORS.inkDim,
          fontWeight: 600,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 12}px)`,
        }}
      >
        The marketplace in your pocket
      </div>

      <div
        style={{
          marginTop: 56,
          display: "flex",
          gap: 18,
          alignItems: "center",
          opacity: ctaIn,
          transform: `scale(${ctaIn * pulse})`,
        }}
      >
        <div
          style={{
            background: IG_GRADIENT,
            color: COLORS.ink,
            padding: "22px 42px",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 1,
            textTransform: "uppercase",
            boxShadow: "0 20px 60px -20px rgba(220,42,116,0.6)",
          }}
        >
          Download today
        </div>
        <div
          style={{
            border: "1.5px solid rgba(255,255,255,0.25)",
            color: COLORS.ink,
            padding: "22px 42px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          App Store · Play
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          fontSize: 18,
          letterSpacing: 6,
          color: COLORS.inkFaint,
          fontWeight: 600,
          opacity: url,
        }}
      >
        PUBSTORE.WORLD
      </div>
    </AbsoluteFill>
  );
};
