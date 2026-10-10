import {
  type ControlPoint,
  cameraCover,
  type Experience,
  type GameHost,
  isFresh,
  mountMovementControls,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { RULES, Run, type RunFrame } from "./run";
import { createScene } from "./scene";
import "./style.css";

/** Leaving takes a deliberate hold, so no confirmation is asked. */
const EXIT_HOLD_MS = 2000;
const UI_INTERVAL_MS = 100;
const LANES = { "-1": "esquerda", "0": "meio", "1": "direita" } as const;
/** How long the screen answers a collision, and the return of hearts. */
const HIT_FLASH_MS = 500;
const REFILL_NOTE_MS = 2200;

function Prompt({ run, state }: { run: Run; state: "loading" | "failed" | "ready" }) {
  if (state === "failed")
    return (
      <p class="race-prompt" role="alert">
        Não foi possível carregar a pista. Volte ao menu e abra a corrida novamente.
      </p>
    );
  if (state === "loading")
    return (
      <p class="race-prompt" role="status">
        Preparando a pista…
      </p>
    );
  if (run.phase === "running") {
    // While running the road is left clear: words appear only when the player needs to move.
    const text = !run.tracking
      ? "Cadê você? Volte para a frente da câmera"
      : run.puppet?.nearEdge
        ? "Volte um pouco para o meio"
        : null;
    return text ? (
      <p class="race-prompt race-prompt--warning" role="status">
        {text}
      </p>
    ) : null;
  }
  return (
    <p class="race-prompt" role="status" style={{ "--settled": `${run.settled * 100}%` }}>
      {run.phase === "settling"
        ? "Isso! Fique aí…"
        : run.waitingFor === "middle"
          ? "Venha para o meio"
          : "Fique de frente para a câmera"}
    </p>
  );
}

function RaceUI({
  run,
  state,
  onExit,
}: {
  run: Run;
  state: "loading" | "failed" | "ready";
  onExit: () => void;
}) {
  const percent = (share: number | null) => (share === null ? "–" : `${Math.round(share * 100)}%`);
  const puppet = run.phase === "running" ? run.puppet : null;
  const now = performance.now();
  const hit = now - run.hitAt < HIT_FLASH_MS;
  return (
    <div class={`race-ui ${hit ? "race-ui--hit" : ""}`}>
      {puppet ? (
        <div class="race-tally">
          <span role="img" aria-label={`${run.hearts} corações`}>
            {Array.from({ length: RULES.hearts }, (_, index) => (
              <b class={index < run.hearts ? "" : "race-heart--lost"} aria-hidden="true">
                ♥
              </b>
            ))}
          </span>
          <span>{run.points} pontos</span>
        </div>
      ) : null}
      {now - run.refilledAt < REFILL_NOTE_MS ? (
        // What losing every heart should cost is undecided; for now they simply come back.
        <p class="race-note" role="status">
          Corações de volta!
        </p>
      ) : null}
      <Prompt run={run} state={state} />
      <button class="race-back" type="button" data-dwell-ms={EXIT_HOLD_MS} onClick={onExit}>
        Voltar
      </button>
      {puppet ? (
        // For tuning on the phone: what the game currently reads from the player.
        <p class="race-reading">
          faixa {LANES[puppet.lane]} · agachado {Math.round(puppet.crouch * 100)}%
          {puppet.ducked ? " ✓" : ""} · pulo {Math.round(puppet.rise * 100)}%
          {puppet.jumping ? " ✓" : ""} · soco E {percent(puppet.reach.left)} D{" "}
          {percent(puppet.reach.right)}
          {puppet.lastPunch
            ? ` · último ${puppet.lastPunch.side === "left" ? "E" : "D"} +${Math.round(
                puppet.lastPunch.rise * 100,
              )}% em ${Math.round(puppet.lastPunch.ms)} ms`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Corrida, rebuilt from the feel outwards: the road seen through the eyes of a character that
 * steps, crouches, jumps and holds its arms as the player does, past every kind of obstacle in
 * random order. The shape of a whole run is not decided yet.
 */
export function mountCorrida(container: HTMLElement, host: GameHost): Experience<RunFrame> {
  const root = document.createElement("section");
  root.className = "race-game";
  root.setAttribute("aria-label", "Corrida dos Blocos");
  const world = document.createElement("div");
  world.className = "race-world";
  const ui = document.createElement("div");
  ui.className = "race-ui-root";
  root.append(world, ui);
  container.append(root);
  let scene: ReturnType<typeof createScene>;
  try {
    scene = createScene(world);
  } catch (error) {
    root.remove();
    throw error;
  }

  const run = new Run(Math.floor(Math.random() * 2 ** 31));
  let frame: RunFrame | null = null;
  let state: "loading" | "failed" | "ready" = "loading";
  let disposed = false;
  let request = 0;
  let drawnAt = Number.NEGATIVE_INFINITY;
  const controls = mountMovementControls(root, { pointer: "target" });
  const drawUI = () => render(<RaceUI run={run} state={state} onExit={host.exit} />, ui);
  const fail = () => {
    if (disposed) return;
    state = "failed";
    // Nothing half-drawn stays behind the message.
    world.hidden = true;
    drawUI();
  };
  void scene.ready.then(() => {
    if (disposed) return;
    state = "ready";
    drawUI();
  }, fail);
  const canvas = world.querySelector("canvas");
  const contextLost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  canvas?.addEventListener("webglcontextlost", contextLost);

  function tick(now: number) {
    if (disposed) return;
    if (state === "ready") {
      run.tick(now, document.hidden ? null : frame);
      scene.render(run, now);
    }
    // The only button is reached with a real hand: where the wrist is in the camera's view.
    const points: ControlPoint[] = [];
    const body = frame && isFresh(frame, now) ? frame.bodies[0] : undefined;
    if (frame && body) {
      const cover = cameraCover(frame.width, frame.height, innerWidth, innerHeight);
      for (const side of ["left", "right"] as const) {
        const wrist = body[`${side}Wrist`];
        if (wrist)
          points.push({
            key: side,
            x: cover.left + (1 - wrist.x) * cover.width,
            y: cover.top + wrist.y * cover.height,
          });
      }
    }
    controls.update(points, now);
    if (now - drawnAt >= UI_INTERVAL_MS) {
      drawUI();
      drawnAt = now;
    }
    request = requestAnimationFrame(tick);
  }
  drawUI();
  request = requestAnimationFrame(tick);
  return {
    update(next) {
      frame = next;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      controls.dispose();
      canvas?.removeEventListener("webglcontextlost", contextLost);
      render(null, ui);
      scene.dispose();
      root.remove();
    },
  };
}
