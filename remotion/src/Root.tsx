import { Composition } from "remotion";
import { MainVideo, FPS, TOTAL_FRAMES, WIDTH, HEIGHT } from "./MainVideo";

export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
