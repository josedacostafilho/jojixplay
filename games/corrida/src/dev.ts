import type { Body } from "@jojixplay/game-sdk";
import { mountCorrida } from "./index";
import { POSES, targetPose } from "./movement";
const stage = document.querySelector("main"),
  crouch = document.querySelector<HTMLInputElement>("#crouch"),
  lost = document.querySelector<HTMLInputElement>("#lost"),
  edge = document.querySelector<HTMLInputElement>("#edge"),
  pose = document.querySelector<HTMLSelectElement>("#pose"),
  jump = document.querySelector<HTMLButtonElement>("#jump");
if (!stage || !crouch || !lost || !edge || !pose || !jump)
  throw new Error("Missing studio controls");
const view = mountCorrida(stage);
let sequence = 0,
  jumpAt = -Infinity,
  down = false,
  pointer: { x: number; y: number } | null = null;
jump.addEventListener("click", () => {
  jumpAt = performance.now();
});
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
  if (event.code === "ArrowDown") {
    down = true;
    event.preventDefault();
  }
  if (event.code === "Space" && !event.repeat) {
    jumpAt = performance.now();
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") down = false;
});
window.addEventListener("blur", () => {
  down = false;
});
stage.addEventListener("pointermove", (event) => {
  const r = stage.getBoundingClientRect();
  pointer = { x: (event.clientX - r.left) / r.width, y: (event.clientY - r.top) / r.height };
});
stage.addEventListener("pointerleave", () => {
  pointer = null;
});
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
const timer = setInterval(() => {
  if (lost.checked) {
    view.update(null);
    return;
  }
  const now = performance.now(),
    duck = crouch.checked || down,
    center = edge.checked ? 0.05 : 0.5;
  const t = (now - jumpAt) / 750,
    lift = !duck && t >= 0 && t < 1 ? Math.sin(t * Math.PI) * 0.12 : 0;
  const y = 0.31 + (duck ? 0.15 : 0) - lift;
  const name = POSES.find((p) => p === pose.value),
    target = targetPose(name ?? "asas");
  const body: Partial<Record<keyof Body, ReturnType<typeof joint>>> = {};
  for (const [key, p] of Object.entries(target))
    body[key as keyof Body] = joint(center + (p.x * 0.15) / (16 / 9), y - p.y * 0.15);
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    body[`${side}Hip`] = joint(center + sign * 0.04, y + 0.19);
    body[`${side}Knee`] = joint(center + sign * (duck ? 0.09 : 0.04), duck ? y + 0.21 : y + 0.33);
    body[`${side}Ankle`] = joint(center + sign * 0.04, 0.84 - lift);
    if (!name) {
      body[`${side}Elbow`] = joint(center + sign * 0.075, y + 0.1);
      body[`${side}Wrist`] = joint(center + sign * 0.085, y + 0.22);
    }
  }
  if (pointer) body.rightWrist = joint(0.5 + (0.5 - pointer.x) / 2, 0.45 + (pointer.y - 0.5) * 0.6);
  view.update({
    sequence: sequence++,
    capturedAtMs: now,
    width: 1280,
    height: 720,
    epoch: 0,
    bodies: [body],
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
