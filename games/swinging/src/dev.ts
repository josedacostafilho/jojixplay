import { SwingPhysics, type Side } from "./physics";
import { createScene } from "./scene";
import "./dev.css";

const stage = document.querySelector<HTMLElement>("#game"),
  start = document.querySelector<HTMLButtonElement>("#start"),
  left = document.querySelector<HTMLButtonElement>("#left"),
  right = document.querySelector<HTMLButtonElement>("#right"),
  jump = document.querySelector<HTMLButtonElement>("#jump"),
  status = document.querySelector<HTMLOutputElement>("#status");
if (!stage || !start || !left || !right || !jump || !status)
  throw new Error("Missing studio controls");

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
function updateArm(side: Side) {
  const raised = held[side].pointer || held[side].key || held[side].focusKey;
  physics.setArm(side, raised);
  buttons[side].setAttribute("aria-pressed", String(raised));
}
function bindArm(side: Side) {
  const button = buttons[side];
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    held[side].pointer = true;
    updateArm(side);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(eventName, () => {
      held[side].pointer = false;
      updateArm(side);
    });
  button.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    held[side].focusKey = true;
    updateArm(side);
    event.preventDefault();
  });
  button.addEventListener("keyup", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    held[side].focusKey = false;
    updateArm(side);
    event.preventDefault();
  });
}
bindArm("left");
bindArm("right");
start.addEventListener("click", () => physics.start());
jump.addEventListener("click", () => physics.jump());
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
    physics.start();
    event.preventDefault();
  }
  if (event.code === "KeyW" && !event.repeat) {
    physics.jump();
    event.preventDefault();
  }
  const side = event.code === "KeyA" ? "left" : event.code === "KeyD" ? "right" : null;
  if (side) {
    held[side].key = true;
    updateArm(side);
    event.preventDefault();
  }
});
window.addEventListener("keyup", (event) => {
  const side = event.code === "KeyA" ? "left" : event.code === "KeyD" ? "right" : null;
  if (side) {
    held[side].key = false;
    updateArm(side);
  }
});
window.addEventListener("blur", () => {
  for (const side of ["left", "right"] as const) {
    held[side].key = false;
    held[side].pointer = false;
    held[side].focusKey = false;
    updateArm(side);
  }
});
let request = 0,
  previous: number | null = null,
  lastStatus = -Infinity;
function tick(now: number) {
  updateArm("left");
  updateArm("right");
  physics.advance(previous === null ? 0 : (now - previous) / 1000);
  previous = now;
  scene.render(physics, now);
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
