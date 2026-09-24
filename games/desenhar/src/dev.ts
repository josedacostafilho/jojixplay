import type { Body } from "@jojixplay/game-sdk";
import { mountDesenhar } from "./index";
const stage = document.querySelector("main"),
  players = document.querySelector<HTMLSelectElement>("#players"),
  paint = document.querySelector<HTMLInputElement>("#paint"),
  lost = document.querySelector<HTMLInputElement>("#lost");
if (!stage || !players || !paint || !lost) throw new Error("Controles de teste indisponíveis.");
let view = mountDesenhar(stage, 1),
  x = 0.5,
  y = 0.5,
  shift = false,
  sequence = 0;
players.onchange = () => {
  view.dispose();
  view = mountDesenhar(stage, players.value === "2" ? 2 : 1);
};
window.addEventListener("pointermove", (event) => {
  const rect = stage.getBoundingClientRect();
  x = (event.clientX - rect.left) / rect.width;
  y = (event.clientY - rect.top) / rect.height;
});
window.addEventListener("keydown", (event) => {
  shift = event.shiftKey;
});
window.addEventListener("keyup", (event) => {
  shift = event.shiftKey;
});
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
function body(screenX: number, brushX: number, brushY: number): Body {
  return {
    leftShoulder: joint(1 - screenX - 0.05, 0.4),
    rightShoulder: joint(1 - screenX + 0.05, 0.4),
    rightWrist: joint(1 - brushX, brushY),
    leftWrist: joint(1 - screenX - 0.12, paint?.checked || shift ? 0.2 : 0.65),
  };
}
const timer = setInterval(() => {
  if (lost.checked) {
    view.update(null);
    return;
  }
  view.update({
    sequence: sequence++,
    capturedAtMs: performance.now(),
    width: 1280,
    height: 720,
    epoch: 0,
    bodies:
      players.value === "2"
        ? [body(0.25, x * 0.5, y), body(0.75, 0.5 + x * 0.5, y)]
        : [body(0.5, x, y)],
  });
}, 33);
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(timer);
    view.dispose();
  },
  { once: true },
);
