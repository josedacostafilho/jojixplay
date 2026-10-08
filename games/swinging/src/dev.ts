import { SwingPhysics, type Side } from "./physics";
import { createScene } from "./scene";
import "./dev.css";
import "./style.css";
import { HandControl } from "./gestures";
import { studioHand } from "./studio-hand";
import type { TrackedHand } from "@jojixplay/game-sdk";

const stage = document.querySelector<HTMLElement>("#game"),
  start = document.querySelector<HTMLButtonElement>("#start"),
  left = document.querySelector<HTMLButtonElement>("#left"),
  right = document.querySelector<HTMLButtonElement>("#right"),
  status = document.querySelector<HTMLOutputElement>("#status");
if (!stage || !start || !left || !right || !status) throw new Error("Missing studio controls");

const output: HTMLOutputElement = status;
const physics = new SwingPhysics();
let scene: ReturnType<typeof createScene>;
try {
  scene = createScene(stage);
} catch (error) {
  output.textContent = "Não foi possível abrir a cidade em WebGL2.";
  throw error;
}
const held = {
  left: { pointer: false, key: false, focusKey: false },
  right: { pointer: false, key: false, focusKey: false },
};
const buttons = { left, right };
const controls = { left: new HandControl("left"), right: new HandControl("right") };
const hands: Record<Side, TrackedHand | null> = { left: null, right: null };
for (const side of ["left", "right"] as const) {
  for (const axis of ["x", "y"] as const) {
    const input = document.querySelector<HTMLInputElement>(`#${side}-${axis}`);
    input?.addEventListener("input", () => {
      if (!controls[side].closed) controls[side].aim[axis] = Number(input.value);
    });
  }
}

function updateFist(side: Side) {
  const closed = held[side].pointer || held[side].key || held[side].focusKey;
  const control = controls[side];
  if (closed && !control.closed) {
    const ray = scene.ray(control.aim);
    physics.shoot(side, ray.origin, ray.direction);
  }
  if (!closed) physics.release(side);
  control.closed = closed;
  const reference = studioHand(0, 0, false).landmarks[8];
  hands[side] = studioHand(
    1 - control.aim.x - (reference?.x ?? 0),
    control.aim.y - (reference?.y ?? 0),
    closed,
  );
  buttons[side].setAttribute("aria-pressed", String(closed));
}
function bindFist(side: Side) {
  const button = buttons[side];
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    held[side].pointer = true;
    updateFist(side);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(eventName, () => {
      held[side].pointer = false;
      updateFist(side);
    });
  button.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    held[side].focusKey = true;
    updateFist(side);
    event.preventDefault();
  });
  button.addEventListener("keyup", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    held[side].focusKey = false;
    updateFist(side);
    event.preventDefault();
  });
}
bindFist("left");
bindFist("right");
start.addEventListener("click", () => physics.start());
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
    physics.start();
    event.preventDefault();
  }
  const side = event.code === "KeyA" ? "left" : event.code === "KeyD" ? "right" : null;
  if (side) {
    held[side].key = true;
    updateFist(side);
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  const side = event.code === "KeyA" ? "left" : event.code === "KeyD" ? "right" : null;
  if (side) {
    held[side].key = false;
    updateFist(side);
  }
});
window.addEventListener("blur", () => {
  for (const side of ["left", "right"] as const) {
    held[side].key = false;
    held[side].pointer = false;
    held[side].focusKey = false;
    updateFist(side);
  }
});
let request = 0,
  previous: number | null = null,
  lastStatus = -Infinity;
function tick(now: number) {
  updateFist("left");
  updateFist("right");
  physics.advance(previous === null ? 0 : (now - previous) / 1000);
  previous = now;
  scene.render(physics, now, controls, hands);
  if (now - lastStatus > 150) {
    const phase = {
      ready: "Pronto para começar",
      roof: "Correndo no telhado",
      air: "No ar",
      lost: "Fim! Aperte Começar para tentar de novo",
    }[physics.phase];
    output.textContent = `${phase} · ${Math.round(Math.hypot(physics.velocity.x, physics.velocity.z))} m/s · E ${physics.webs.left ? "presa" : "solta"} · D ${physics.webs.right ? "presa" : "solta"}`;
    lastStatus = now;
  }
  request = requestAnimationFrame(tick);
}
request = requestAnimationFrame(tick);
window.addEventListener(
  "pagehide",
  () => {
    cancelAnimationFrame(request);
    scene.dispose();
  },
  { once: true },
);
