import type { Body } from "@jojixplay/game-sdk";
import { mountCorrida } from "./index";

// Stands in for the camera: a synthetic person whose position follows the pointer, with switches
// for crouching, arm shapes, leaning, a smaller and more distant player, and lost tracking.
function need<E extends Element>(selector: string): E {
  const element = document.querySelector<E>(selector);
  if (!element) throw new Error(`Missing studio control ${selector}`);
  return element;
}
const stage = need<HTMLElement>("main");
const crouch = need<HTMLInputElement>("#crouch");
const leaning = need<HTMLInputElement>("#lean");
const small = need<HTMLInputElement>("#small");
const lost = need<HTMLInputElement>("#lost");
const arms = need<HTMLSelectElement>("#arms");
const view = mountCorrida(stage, {
  exit: () => location.reload(),
  sense: async () => {},
  showCamera: () => {},
  camera: () => null,
});
let sequence = 0;
let down = false;
/** Where the person stands, across the camera's view. The camera sees them the other way round. */
let x = 0.5;
window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowDown") down = true;
});
window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") down = false;
});
stage.addEventListener("pointermove", (event) => {
  const bounds = stage.getBoundingClientRect();
  x = 1 - (event.clientX - bounds.left) / bounds.width;
});
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
function person(): Body {
  // Half a shoulder width, as a share of the view's width; everything else scales from it.
  const half = small.checked ? 0.022 : 0.045;
  const unit = half * 2 * (1280 / 720);
  const drop = crouch.checked || down ? unit * 0.8 : 0;
  const shift = leaning.checked ? half * 1.3 : 0;
  const shoulderY = 0.3 + drop;
  const body: Record<string, ReturnType<typeof joint>> = {
    leftShoulder: joint(x + half + shift, shoulderY),
    rightShoulder: joint(x - half + shift, shoulderY + (leaning.checked ? -0.02 : 0)),
    leftHip: joint(x + half * 0.7, 0.3 + unit * 1.45 + drop * 0.5),
    rightHip: joint(x - half * 0.7, 0.3 + unit * 1.45 + drop * 0.5),
  };
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    const shape = arms.value === "left" ? (side === "left" ? "up" : "down") : arms.value;
    const shoulder = body[`${side}Shoulder`];
    if (!shoulder) continue;
    const [dx, dy] = shape === "out" ? [1, 0] : shape === "up" ? [0.25, -1] : [0.12, 1];
    body[`${side}Elbow`] = joint(
      shoulder.x + sign * dx * half * 1.3,
      shoulder.y + dy * unit * 0.65,
    );
    body[`${side}Wrist`] = joint(shoulder.x + sign * dx * half * 2.6, shoulder.y + dy * unit * 1.3);
  }
  return body;
}
const timer = setInterval(() => {
  view.update(
    lost.checked
      ? null
      : {
          sequence: sequence++,
          capturedAtMs: performance.now(),
          width: 1280,
          height: 720,
          epoch: 0,
          bodies: [person()],
        },
  );
}, 33);
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(timer);
    view.dispose();
  },
  { once: true },
);
