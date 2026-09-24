import type { Body, BodyFrame } from "@jojixplay/game-sdk";
import { mountMovementView } from "@jojixplay/movement-view";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing development root.");
root.innerHTML = `<header><h1>Movement input lab</h1><p>Independent synthetic input. No camera, app imports or game rules.</p><label>Visible body <select id="crop"><option value="full">Full body</option><option value="legs">Feet outside frame</option><option value="upper">Upper body only</option><option value="hand">One hand only</option><option value="missing">No body</option></select></label><label><input id="two" type="checkbox"> Adult + child</label><button id="pause" type="button">Pause input (test staleness)</button></header><main aria-label="Synthetic movement scene"></main>`;
const stage = root.querySelector("main");
const crop = root.querySelector<HTMLSelectElement>("#crop");
const two = root.querySelector<HTMLInputElement>("#two");
const pause = root.querySelector<HTMLButtonElement>("#pause");
if (!stage || !crop || !two || !pause) throw new Error("Missing input controls.");
const view = mountMovementView(stage);
let paused = false,
  sequence = 0;
pause.onclick = () => {
  paused = !paused;
  pause.textContent = paused ? "Resume input" : "Pause input (test staleness)";
};
function body(time: number, offset: number, scale: number): Body {
  const points: Array<[keyof Body, number, number]> = [
    ["nose", 0.5, 0.15],
    ["leftShoulder", 0.38, 0.3],
    ["rightShoulder", 0.62, 0.3],
    ["leftElbow", 0.28, 0.43],
    ["rightElbow", 0.73, 0.3],
    ["leftWrist", 0.22, 0.5],
    ["rightWrist", 0.8, 0.2 + Math.sin(time / 400) * 0.07],
    ["leftHip", 0.42, 0.58],
    ["rightHip", 0.58, 0.58],
    ["leftKnee", 0.4, 0.75],
    ["rightKnee", 0.6, 0.75],
    ["leftAnkle", 0.38, 0.92],
    ["rightAnkle", 0.62, 0.92],
  ];
  return Object.fromEntries(
    points
      .filter(
        ([name, , y]) =>
          crop?.value !== "missing" &&
          (crop?.value !== "upper" || y < 0.55) &&
          (crop?.value !== "legs" || y < 0.85) &&
          (crop?.value !== "hand" || name === "rightWrist"),
      )
      .map(([name, x, y]) => [
        name,
        { x: (x - 0.5) * scale + 0.5 + offset, y: (y - 0.5) * scale + 0.5, z: 0, confidence: 1 },
      ]),
  );
}
const timer = window.setInterval(() => {
  if (paused) return;
  const now = performance.now();
  const frame: BodyFrame = {
    sequence: sequence++,
    capturedAtMs: now,
    width: 1280,
    height: 720,
    epoch: 0,
    bodies: two.checked ? [body(now, -0.22, 0.7), body(now, 0.23, 0.48)] : [body(now, 0, 1)],
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
