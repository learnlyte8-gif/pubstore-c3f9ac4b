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

interface Props {
  image: string;
  eyebrow: string;
  title: string;
  price: string;
  originalPrice: string;
  tag: string;
  accent: string;
  mirror?: boolean;
}

export const SceneFeature: React.FC<Props> = ({
  image,
  eyebrow,
  title,
  price,
  originalPrice,
  tag,
  accent,
  mirror,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imgIn = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const imgKen = interpolate(frame, [0, 105], [1.0, 1.08]);
  const eyebrowIn = spring({
    frame: frame - 8,
    fps,
    config: { damping: 200 },
  });
  const titleClip = interpolate(frame, [12, 42], [0, 100], {
    extrapolateRight: "clamp",
  });
  const priceIn = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 130 },
  });
  const tagIn = spring({ frame: frame - 42, fps, config: { damping: 200 } });

  const exit = interpolate(frame, [88, 104], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ImgCol = (
    <div
      style={{
        flex: "0 0 46%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        margin: "60px 0",
        boxShadow: "0 60px 120px -30px rgba(0,0,0,0.7)",
      }}
    >
      <Img
        src={staticFile(image)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${imgKen}) translateY(${(1 - imgIn) * 60}px)`,
          opacity: imgIn,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 50%, ${accent}33 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          background: COLORS.ink,
          color: COLORS.bg,
          padding: "10px 18px",
          borderRadius: 999,
          fontFamily: inter.fontFamily,
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: 1,
          textTransform: "uppercase",
          opacity: tagIn,
          transform: `translateY(${(1 - tagIn) * -10}px)`,
        }}
      >
        ◉ {tag}
      </div>
    </div>
  );

  const TextCol = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 80px",
        color: COLORS.ink,
        fontFamily: inter.fontFamily,
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: 6,
          fontWeight: 600,
          color: accent,
          textTransform: "uppercase",
          opacity: eyebrowIn,
          transform: `translateX(${(1 - eyebrowIn) * (mirror ? 20 : -20)}px)`,
          marginBottom: 28,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: anton.fontFamily,
          fontSize: 200,
          lineHeight: 0.9,
          letterSpacing: -2,
          textTransform: "uppercase",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            clipPath: `inset(0 ${100 - titleClip}% 0 0)`,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          marginTop: 44,
          display: "flex",
          alignItems: "baseline",
          gap: 24,
          opacity: priceIn,
          transform: `translateY(${(1 - priceIn) * 20}px)`,
        }}
      >
        <div
          style={{
            fontFamily: anton.fontFamily,
            fontSize: 120,
            lineHeight: 1,
            background: IG_GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {price}
        </div>
        <div
          style={{
            fontSize: 36,
            color: COLORS.inkFaint,
            textDecoration: "line-through",
            fontWeight: 400,
          }}
        >
          {originalPrice}
        </div>
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 22,
          color: COLORS.inkDim,
          opacity: priceIn,
        }}
      >
        Tap. Order. Delivered.
      </div>
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        flexDirection: mirror ? "row-reverse" : "row",
        padding: "0 100px",
        transform: `translateY(${exit * -40}px)`,
        opacity: 1 - exit * 0.4,
      }}
    >
      {ImgCol}
      {TextCol}
    </AbsoluteFill>
  );
};
