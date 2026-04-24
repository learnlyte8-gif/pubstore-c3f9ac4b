import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { IG_GRADIENT } from "../theme";

export const PersistentBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 80;
  const drift2 = Math.cos(frame / 110) * 60;
  return (
    <AbsoluteFill style={{ background: "#0A0A0A" }}>
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 1400,
          left: -300 + drift,
          top: -400 + drift2,
          background: IG_GRADIENT,
          filter: "blur(180px)",
          opacity: 0.28,
          borderRadius: "50%",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -200 - drift,
          bottom: -300 - drift2,
          background:
            "linear-gradient(135deg, #3D2EAA 0%, #962FBF 60%, #DC2A74 100%)",
          filter: "blur(200px)",
          opacity: 0.22,
          borderRadius: "50%",
        }}
      />
    </AbsoluteFill>
  );
};
