import {
  isFresh,
  mountMovementControls,
  reachableHand,
  type BodyFrame,
  type ControlPoint,
  type Experience,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { createScene } from "./scene";
import { SwingSession } from "./session";
import "./style.css";

export function mountSwinging(container: HTMLElement): Experience {
  const root = document.createElement("section");
  root.className = "swing-game";
  root.setAttribute("aria-label", "Protótipo de balanço com teias");
  const world = document.createElement("div");
  world.className = "swing-world";
  const ui = document.createElement("div");
  ui.className = "swing-ui-root";
  root.append(world, ui);
  container.append(root);
  let scene: ReturnType<typeof createScene>;
  try {
    scene = createScene(world);
  } catch (error) {
    root.remove();
    throw error;
  }
  const session = new SwingSession();
  const controls = mountMovementControls(root);
  let frame: BodyFrame | null = null;
  let request = 0;
  let lastUI = -Infinity;
  let disposed = false;
  let help = false;
  let error = false;
  const onContextLost = (event: Event) => {
    event.preventDefault();
    error = true;
    drawUI();
  };
  world.querySelector("canvas")?.addEventListener("webglcontextlost", onContextLost);
  function drawUI() {
    const phase = session.physics.phase;
    render(
      <div class="swing-ui">
        {phase === "ready" && !error && (
          <section class="swing-panel swing-start" aria-label="Preparar balanço">
            <h1>Agache para começar</h1>
            <p>Segure por 3 segundos. Depois, levante os braços para lançar teias.</p>
            <div
              class="swing-progress"
              role="progressbar"
              aria-label="Tempo agachado"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={Math.round(session.entryProgress * 3 * 10) / 10}
            >
              <i style={{ width: `${session.entryProgress * 100}%` }} />
            </div>
          </section>
        )}
        {phase === "air" && !error && (
          <p class="swing-hud" role="status">
            {session.physics.webs.left ? "Teia esquerda presa" : "Esquerda livre"} ·{" "}
            {session.physics.webs.right ? "Teia direita presa" : "Direita livre"}
          </p>
        )}
        {phase === "lost" && !error && (
          <section class="swing-panel swing-result" aria-label="Fim da tentativa">
            <h1>Vamos de novo?</h1>
            <p>O chão ou a água encerrou esta tentativa.</p>
            <button
              type="button"
              onClick={() => {
                session.replay();
                controls.reset();
                drawUI();
              }}
            >
              Recomeçar ↻
            </button>
          </section>
        )}
        {!session.gestures.tracking && phase !== "lost" && !error && (
          <p class="swing-tracking" role="status">
            Não vejo você. Volte para a câmera!
          </p>
        )}
        {error ? (
          <section class="swing-panel swing-result" role="alert">
            <h1>A cidade parou</h1>
            <p>Não foi possível desenhar o jogo. Volte ao menu e tente novamente.</p>
          </section>
        ) : (
          !help && (
            <button
              class="swing-help-button"
              type="button"
              onClick={() => {
                help = true;
                controls.reset();
                drawUI();
              }}
            >
              ? Como jogar
            </button>
          )
        )}
        {help && (
          <section class="swing-help" aria-label="Como jogar">
            <h2>Balance com as teias</h2>
            <p>
              Levante um braço para lançar e segurar a teia. Abaixe para soltar. Use os dois lados
              para virar.
            </p>
            <p>
              Faça um pequeno agachamento e suba para dar um impulso. Não deixe a cidade chegar ao
              chão!
            </p>
            <button
              type="button"
              onClick={() => {
                help = false;
                controls.reset();
                drawUI();
              }}
            >
              Entendi
            </button>
          </section>
        )}
      </div>,
      ui,
    );
  }
  function tick(now: number) {
    if (disposed) return;
    if (!error) {
      session.tick(now, frame);
      scene.render(session.physics, now);
    }
    const points: ControlPoint[] = [];
    if (frame && isFresh(frame, now) && frame.bodies.length === 1) {
      const bounds = root.getBoundingClientRect();
      for (const side of ["left", "right"] as const) {
        const wrist = frame.bodies[0]?.[`${side}Wrist`];
        if (!wrist) continue;
        const point = reachableHand(wrist.x, wrist.y);
        points.push({
          key: side,
          x: bounds.left + point.x * bounds.width,
          y: bounds.top + point.y * bounds.height,
        });
      }
    }
    controls.update(points, now);
    if (now - lastUI > 100) {
      drawUI();
      lastUI = now;
    }
    request = requestAnimationFrame(tick);
  }
  drawUI();
  request = requestAnimationFrame(tick);
  return {
    update(next) {
      if (!next || next.epoch !== frame?.epoch) controls.reset();
      frame = next;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      controls.dispose();
      world.querySelector("canvas")?.removeEventListener("webglcontextlost", onContextLost);
      render(null, ui);
      scene.dispose();
      root.remove();
    },
  };
}
