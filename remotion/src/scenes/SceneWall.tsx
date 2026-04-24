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

type Tile = {
  src: string;
  label: string;
  price: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  delay: number;
};

const TILES: Tile[] = [
  { src: "products/p2.jpg", label: "Platform Boots", price: "$64", x: 60, y: 120, w: 380, h: 480, rot: -3, delay: 0 },
  { src: "products/p4.jpg", label: "Pepper Mill", price: "$5.23", x: 470, y: 80, w: 320, h: 320, rot: 2, delay: 4 },
  { src: "products/p5.jpg", label: "Chunky Sandals", price: "$50", x: 820, y: 140, w: 360, h: 440, rot: -2, delay: 8 },
  { src: "products/p7.jpg", label: "Calf Boots", price: "$90.99", x: 1210, y: 70, w: 320, h: 420, rot: 3, delay: 12 },
  { src: "products/p1.jpg", label: "Pearl Earrings", price: "$28.60", x: 1560, y: 200, w: 290, h: 360, rot: -3, delay: 16 },
  { src: "products/p3.jpg", label: "Timberland", price: "$117", x: 200, y: 640, w: 380, h: 360, rot: 2, delay: 6 },
  { src: "products/p6.jpg", label: "Boxy Hoodie", price: "$12.80", x: 620, y: 620, w: 360, h: 380, rot: -2, delay: 10 },
  { src: "products/p2.jpg", label: "+10k more", price: "Daily", x: 1020, y: 660, w: 340, h: 340, rot: 3, delay: 14 },
  { src: "products/p7.jpg", label: "Trade Assured", price: "Verified", x: 1390, y: 620, w: 360, h: 380, rot: -3, delay: 18 },
];

export const SceneWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 200 } });
  const headerOut = interpolate(frame, [70, 88], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "rgba(10,10,10,0.4)" }}>
      {TILES.map((t, i) => {
        const sp = spring({
          frame: frame - t.delay,
          fps,
          config: { damping: 14, stiffness: 110, mass: 0.8 },
        });
        const float = Math.sin((frame - t.delay) / 22 + i) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y + float,
              width: t.w,
              height: t.h,
              transform: `rotate(${t.rot}deg) scale(${sp})`,
              opacity: sp,
              borderRadius: 18,
              overflow: "hidden",
              boxShadow:
                "0 30px 80px -20px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3)",
              background: COLORS.surface,
            }}
          >
            <Img
              src={staticFile(t.src)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.85) 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 12,
                color: COLORS.ink,
                fontFamily: inter.fontFamily,
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.8, fontWeight: 600 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.gold }}>
                {t.price}
              </div>
            </div>
          </div>
        );
      })}

      {/* Center headline */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: headerIn * headerOut,
            transform: `scale(${0.94 + headerIn * 0.06})`,
            background: "rgba(10,10,10,0.78)",
            backdropFilter: "blur(8px)",
            padding: "28px 56px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            color: COLORS.ink,
            fontFamily: anton.fontFamily,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          <span style={{ fontSize: 84 }}>10,000+ products.</span>{" "}
          <span
            style={{
              fontSize: 84,
              background: IG_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            One app.
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
