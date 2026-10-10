import type { Body, WorldBody } from "@jojixplay/game-sdk";
import { mountRun } from "./index";

// Stands in for the camera: a synthetic person whose position follows the pointer, with switches
// for crouching, jumping, arm shapes, punches, leaning, a smaller and more distant player, and
// lost tracking.
function need<E extends Element>(selector: string): E {
  const element = document.querySelector<E>(selector);
  if (!element) throw new Error(`Missing studio control ${selector}`);
  return element;
}
const stage = need<HTMLElement>("main");
const crouch = need<HTMLInputElement>("#crouch");
const jump = need<HTMLInputElement>("#jump");
const punch = need<HTMLSelectElement>("#punch");
const leaning = need<HTMLSelectElement>("#lean");
const small = need<HTMLInputElement>("#small");
const lost = need<HTMLInputElement>("#lost");
const arms = need<HTMLSelectElement>("#arms");
// `?seconds=20` shortens the run and `?mortal` lets it be failed, to reach either ending quickly.
const query = new URLSearchParams(location.search);
const view = mountRun(
  stage,
  {
    exit: () => location.reload(),
    sense: async () => {},
    showCamera: () => {},
    camera: () => null,
  },
  { seconds: Number(query.get("seconds")) || 300, immortal: !query.has("mortal") },
);
let sequence = 0;
let down = false;
let up = false;
/** The arm a key is holding out, if any: Q the person's left, E their right. */
let jab: "left" | "right" | null = null;
/** Where the person stands, across the camera's view. The camera sees them the other way round. */
let x = 0.5;
window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowDown") down = true;
  if (event.code === "ArrowUp") up = true;
  if (event.code === "KeyQ") jab = "left";
  if (event.code === "KeyE") jab = "right";
});
window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") down = false;
  if (event.code === "ArrowUp") up = false;
  if (event.code === "KeyQ" || event.code === "KeyE") jab = null;
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
  // Off the ground the whole person is higher in the view; crouched, only the top half is lower.
  const air = jump.checked || up ? unit * 0.4 : 0;
  const drop = (crouch.checked || down ? unit * 0.8 : 0) - air;
  // The person's left is the camera's right: leaning to their left moves their shoulders that way.
  const shift = -Number(leaning.value) * half * 1.4;
  const shoulderY = 0.3 + drop;
  const hipY = 0.3 + unit * 1.45 + (drop > 0 ? drop * 0.5 : drop);
  const body: Record<string, ReturnType<typeof joint>> = {
    leftShoulder: joint(x + half + shift, shoulderY),
    rightShoulder: joint(x - half + shift, shoulderY),
    leftHip: joint(x + half * 0.7, hipY),
    rightHip: joint(x - half * 0.7, hipY),
  };
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    const shape =
      arms.value === "left" || arms.value === "right"
        ? arms.value === side
          ? "up"
          : "down"
        : arms.value;
    const shoulder = body[`${side}Shoulder`];
    if (!shoulder) continue;
    const [dx, dy] = shape === "down" ? [0.12, 1] : shape === "up" ? [0.25, -1] : [1, 0];
    const elbow = joint(shoulder.x + sign * dx * half * 1.3, shoulder.y + dy * unit * 0.65);
    body[`${side}Elbow`] = elbow;
    body[`${side}Wrist`] =
      shape === "bent"
        ? joint(elbow.x, elbow.y - unit * 0.65)
        : joint(shoulder.x + sign * dx * half * 2.6, shoulder.y + dy * unit * 1.3);
  }
  return body;
}
/**
 * The same person in their own space: as the picture shows them, at about real size, flat but
 * for an arm thrown straight out towards the camera.
 */
function inOwnSpace(body: Body): WorldBody {
  const hips = body.leftHip && body.rightHip ? body.leftHip : { x: 0.5, y: 0.6 };
  const middle = body.leftHip && body.rightHip ? (body.leftHip.x + body.rightHip.x) / 2 : 0.5;
  const scale = small.checked ? 4 : 2;
  const world: Record<string, { x: number; y: number; z: number; confidence: number }> = {};
  for (const [name, joint] of Object.entries(body))
    world[name] = {
      x: (joint.x - middle) * scale * (1280 / 720),
      y: (joint.y - hips.y) * scale,
      z: 0,
      confidence: 1,
    };
  const thrown = jab ?? (punch.value === "left" || punch.value === "right" ? punch.value : null);
  const shoulder = thrown ? world[`${thrown}Shoulder`] : undefined;
  if (thrown && shoulder) {
    world[`${thrown}Elbow`] = { ...shoulder, z: -0.28 };
    world[`${thrown}Wrist`] = { ...shoulder, z: -0.55 };
  }
  return world;
}
const timer = setInterval(() => {
  const body = person();
  view.update(
    lost.checked
      ? null
      : {
          sequence: sequence++,
          capturedAtMs: performance.now(),
          width: 1280,
          height: 720,
          epoch: 0,
          bodies: [body],
          worldBodies: [inOwnSpace(body)],
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
