import {
  type Body,
  cameraCover,
  type Frame,
  type Hand,
  type HandPointName,
  handPointNames,
  type Sensing,
} from "@jojixplay/game-sdk";
import { mountSensores } from "./index";

// Stands in for the host: a synthetic person whose right hand follows the pointer, and a
// grey page background where the camera image would be.
const stage = document.querySelector("main");
if (!stage) throw new Error("Palco de teste indisponível.");
let sensing: Sensing = "body",
  x = 0.35,
  y = 0.45,
  sequence = 0,
  epoch = 0;
const view = mountSensores(stage, {
  exit: () => location.reload(),
  sense: (next) =>
    new Promise((resolve) => {
      setTimeout(() => {
        sensing = next;
        epoch += 1;
        resolve();
      }, 400);
    }),
  showCamera: (visible) => document.body.classList.toggle("camera", visible),
  // The studio has no camera: the cut-out shows the bare shape.
  camera: () => null,
});
window.addEventListener("pointermove", (event) => {
  const cover = cameraCover(1280, 720, innerWidth, innerHeight);
  x = 1 - (event.clientX - cover.left) / cover.width;
  y = (event.clientY - cover.top) / cover.height;
});
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
function body(): Body {
  return {
    nose: joint(0.5, 0.3),
    leftEye: joint(0.52, 0.28),
    rightEye: joint(0.48, 0.28),
    leftShoulder: joint(0.57, 0.42),
    rightShoulder: joint(0.43, 0.42),
    leftElbow: joint(0.6, 0.58),
    leftWrist: joint(0.61, 0.72),
    rightElbow: joint((0.43 + x) / 2, (0.42 + y) / 2 + 0.05),
    rightWrist: joint(x, y),
    leftHip: joint(0.54, 0.74),
    rightHip: joint(0.46, 0.74),
    leftKnee: joint(0.54, 0.9),
    rightKnee: joint(0.46, 0.9),
  };
}
function hand(side: "left" | "right", wristX: number, wristY: number): Hand {
  const points = Object.fromEntries(
    handPointNames.map((name, index) => {
      const fingerIndex = index === 0 ? 2 : Math.floor((index - 1) / 4);
      const along = index === 0 ? 0 : ((index - 1) % 4) + 1;
      const spread = (fingerIndex - 2) * 0.016 * (side === "left" ? 1 : -1);
      return [name, { x: wristX + spread * (1 + along / 4), y: wristY - along * 0.035, z: 0 }];
    }),
  ) as Record<HandPointName, { x: number; y: number; z: number }>;
  return { side, confidence: 0.98, points };
}
/** A blob for a body and a smaller one that follows the pointer, as a 64 by 36 grid. */
function silhouette() {
  const width = 64;
  const height = 36;
  const alpha = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const cx = (column + 0.5) / width;
      const cy = (row + 0.5) / height;
      const body = Math.hypot((cx - 0.5) / 0.07, (cy - 0.62) / 0.3);
      const hand = Math.hypot((cx - x) / 0.05, (cy - y) / 0.09);
      alpha[row * width + column] = Math.round(
        255 * Math.max(0, Math.min(1, 3 * (1 - Math.min(body, hand)))),
      );
    }
  }
  return { width, height, alpha };
}
const timer = setInterval(() => {
  const frame: Frame = {
    sequence: sequence++,
    capturedAtMs: performance.now() - 40,
    width: 1280,
    height: 720,
    epoch,
    sensing,
    bodies: sensing === "body" || sensing.startsWith("silhouette") ? [body()] : [],
    hands: sensing === "hands" ? [hand("right", x, y + 0.14), hand("left", 0.62, 0.6)] : [],
    silhouette: sensing.startsWith("silhouette") ? silhouette() : null,
  };
  view.update(frame);
}, 33);
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(timer);
    view.dispose();
  },
  { once: true },
);
