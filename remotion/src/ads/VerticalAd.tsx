import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  Img,
  Video,
  Sequence,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { COLORS, IG_GRADIENT } from "../theme";

const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const inter = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

export type AdProps = {
  vertical: string;        // "Market"
  eyebrow: string;         // "Wholesale & Retail"
  hook: string;            // "BUY SMARTER."
  hookAccent: string;      // "SELL FASTER."
  tagline: string;         // "Verified suppliers. Live deals. Shipped worldwide."
  screen: string;          // staticFile path to phone mockup PNG
  buyerBullets: string[];  // 3 lines
  supplierBullets: string[]; // 3 lines
  statBig: string;         // "12K+"
  statLabel: string;       // "Verified suppliers"
  cta: string;             // "Open Pubstore — pubstore.app"
  accent: string;          // hex color
};

// ---------- shared bits ----------
const BG: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 30;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <div
        style={{
          position: "absolute",
          inset: -200,
          background: IG_GRADIENT,
          opacity: 0.35,
          filter: "blur(120px)",
          transform: `translate(${drift}px, ${-drift}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 110%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.9) 80%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.06,
      mixBlendMode: "overlay",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
    }}
  />
);

// ---------- HOOK ----------
const Hook: React.FC<{ p: AdProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eyebrow = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const line1Clip = interpolate(frame, [10, 38], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const line1Y = interpolate(frame, [10, 38], [60, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const line2Clip = interpolate(frame, [22, 50], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const line2Y = interpolate(frame, [22, 50], [60, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const tag = spring({ frame: frame - 42, fps, config: { damping: 200 } });
  const videoOpacity = interpolate(frame, [0, 12, 75, 88], [0, 1, 1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const videoScale = interpolate(frame, [0, 88], [1.08, 1.18]);

  return (
    <AbsoluteFill>
      {/* presenter video bg */}
      <AbsoluteFill style={{ opacity: videoOpacity, transform: `scale(${videoScale})` }}>
        <Video
          src={staticFile("presenter/main.mp4")}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          startFrom={0}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          padding: "180px 80px 120px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          fontFamily: inter.fontFamily,
          color: COLORS.ink,
        }}
      >
        <div
          style={{
            opacity: eyebrow,
            transform: `translateX(${(1 - eyebrow) * -20}px)`,
            letterSpacing: 6,
            fontSize: 26,
            fontWeight: 700,
            color: p.accent,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          ◆ {p.eyebrow}
        </div>

        <div style={{ fontFamily: anton.fontFamily, fontSize: 180, lineHeight: 0.95, letterSpacing: -2, textTransform: "uppercase", overflow: "hidden" }}>
          <div style={{ transform: `translateY(${line1Y}px)`, clipPath: `inset(0 ${100 - line1Clip}% 0 0)` }}>{p.hook}</div>
        </div>
        <div style={{ fontFamily: anton.fontFamily, fontSize: 180, lineHeight: 0.95, letterSpacing: -2, textTransform: "uppercase", overflow: "hidden", marginTop: 4 }}>
          <div
            style={{
              transform: `translateY(${line2Y}px)`,
              clipPath: `inset(0 ${100 - line2Clip}% 0 0)`,
              background: IG_GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {p.hookAccent}
          </div>
        </div>

        <div
          style={{
            marginTop: 38,
            opacity: tag,
            transform: `translateY(${(1 - tag) * 16}px)`,
            fontSize: 34,
            fontWeight: 400,
            color: COLORS.inkDim,
            maxWidth: 880,
            lineHeight: 1.25,
          }}
        >
          {p.tagline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- PITCH (buyer or supplier) ----------
const Pitch: React.FC<{ p: AdProps; audience: "Buyer" | "Supplier"; bullets: string[] }> = ({ p, audience, bullets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const screenIn = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90, mass: 1 } });
  const labelIn = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <BG />
      <AbsoluteFill
        style={{
          padding: "150px 80px",
          fontFamily: inter.fontFamily,
          color: COLORS.ink,
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: labelIn, transform: `translateY(${(1 - labelIn) * 20}px)` }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#000" }}>
            {audience === "Buyer" ? "B" : "S"}
          </div>
          <div style={{ letterSpacing: 6, fontSize: 24, fontWeight: 800, textTransform: "uppercase", color: p.accent }}>
            For {audience}s
          </div>
        </div>

        <div style={{ fontFamily: anton.fontFamily, fontSize: 130, lineHeight: 0.95, textTransform: "uppercase", letterSpacing: -1 }}>
          {audience === "Buyer" ? "Find. Compare. Order." : "List. Reach. Sell."}
        </div>

        <div style={{ display: "flex", gap: 56, alignItems: "center", flex: 1 }}>
          <div
            style={{
              flex: "0 0 480px",
              transform: `translateY(${(1 - screenIn) * 80}px) scale(${0.9 + screenIn * 0.1})`,
              opacity: screenIn,
              filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.6))",
            }}
          >
            <Img src={p.screen} style={{ width: "100%", height: "auto", objectFit: "contain" }} />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 32 }}>
            {bullets.map((b, i) => {
              const t = spring({ frame: frame - (18 + i * 14), fps, config: { damping: 200 } });
              return (
                <div key={i} style={{ opacity: t, transform: `translateX(${(1 - t) * 60}px)`, display: "flex", gap: 22, alignItems: "flex-start" }}>
                  <div style={{ width: 14, height: 14, marginTop: 18, borderRadius: 99, background: p.accent, boxShadow: `0 0 30px ${p.accent}` }} />
                  <div style={{ fontSize: 44, lineHeight: 1.2, fontWeight: 700, color: COLORS.ink }}>{b}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- PROOF ----------
const Proof: React.FC<{ p: AdProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const big = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  return (
    <AbsoluteFill>
      <BG />
      <AbsoluteFill
        style={{
          fontFamily: inter.fontFamily,
          color: COLORS.ink,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          gap: 30,
        }}
      >
        <div style={{ letterSpacing: 8, fontSize: 28, fontWeight: 800, color: p.accent, textTransform: "uppercase" }}>
          Real momentum
        </div>
        <div
          style={{
            fontFamily: anton.fontFamily,
            fontSize: 480,
            lineHeight: 0.85,
            transform: `scale(${0.7 + big * 0.3})`,
            background: IG_GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {p.statBig}
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.ink, textAlign: "center" }}>
          {p.statLabel}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- END CARD ----------
const EndCard: React.FC<{ p: AdProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14 } });
  const cta = spring({ frame: frame - 24, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <BG />
      <AbsoluteFill
        style={{
          fontFamily: inter.fontFamily,
          color: COLORS.ink,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          padding: 80,
        }}
      >
        <div style={{ opacity: logo, transform: `scale(${0.7 + logo * 0.3})`, fontFamily: anton.fontFamily, fontSize: 280, lineHeight: 0.9, textTransform: "uppercase", background: IG_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: -4 }}>
          Pubstore
        </div>
        <div style={{ opacity: cta, fontSize: 42, fontWeight: 700, textAlign: "center", color: COLORS.ink, maxWidth: 900, lineHeight: 1.2 }}>
          {p.cta}
        </div>
        <div style={{ opacity: cta, marginTop: 20, padding: "22px 56px", borderRadius: 999, background: IG_GRADIENT, fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>
          Get the app →
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- MAIN ----------
const HOOK_F = 90;
const PITCH_F = 150;
const PROOF_F = 90;
const END_F = 120;
export const TOTAL = HOOK_F + PITCH_F + PITCH_F + PROOF_F + END_F; // 600

export const VerticalAd: React.FC<AdProps> = (p) => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg, overflow: "hidden" }}>
      <Sequence durationInFrames={HOOK_F}>
        <Hook p={p} />
      </Sequence>
      <Sequence from={HOOK_F} durationInFrames={PITCH_F}>
        <Pitch p={p} audience="Buyer" bullets={p.buyerBullets} />
      </Sequence>
      <Sequence from={HOOK_F + PITCH_F} durationInFrames={PITCH_F}>
        <Pitch p={p} audience="Supplier" bullets={p.supplierBullets} />
      </Sequence>
      <Sequence from={HOOK_F + PITCH_F * 2} durationInFrames={PROOF_F}>
        <Proof p={p} />
      </Sequence>
      <Sequence from={HOOK_F + PITCH_F * 2 + PROOF_F} durationInFrames={END_F}>
        <EndCard p={p} />
      </Sequence>
      <Grain />
    </AbsoluteFill>
  );
};
