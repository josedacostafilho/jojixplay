import {
  mountMovementControls,
  projectHandLandmarks,
  type BodyFrame,
  type ControlPoint,
  type Experience,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { createScene } from "./scene";
import { SwingSession } from "./session";
import "./style.css";

export function mountSwinging(
  container: HTMLElement,
  onRunningChange: (running: boolean) => void,
): Experience {
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
  let running = false;
  const onContextLost = (event: Event) => {
    event.preventDefault();
    error = true;
    drawUI();
  };
  world.querySelector("canvas")?.addEventListener("webglcontextlost", onContextLost);
  function drawUI() {
    const phase = session.physics.phase;
    const nextRunning = !error && (phase === "roof" || phase === "air");
    if (nextRunning !== running) {
      running = nextRunning;
      onRunningChange(running);
      controls.reset();
    }
    render(
      <div class="swing-ui">
        {phase === "ready" && !error && (
          <section class="swing-panel swing-start" aria-label="Preparar balanço">
            <h1>Mostre as mãos abertas</h1>
            <p>Deixe as duas mãos confortáveis e paradas. Abra para mirar, feche para lançar.</p>
            <div
              class="swing-progress"
              role="progressbar"
              aria-label="Preparação das mãos"
              aria-valuemin={0}
              aria-valuemax={1.5}
              aria-valuenow={Math.round(session.entryProgress * 1.5 * 10) / 10}
            >
              <i style={{ width: `${session.entryProgress * 100}%` }} />
            </div>
          </section>
        )}
        {phase === "air" && !error && (
          <p class="swing-hud" role="status">
            {session.physics.webs.left
              ? "Teia esquerda presa"
              : session.gestures.hands.left.closed
                ? "Esquerda: abra a mão"
                : "Esquerda livre"}{" "}
            ·{" "}
            {session.physics.webs.right
              ? "Teia direita presa"
              : session.gestures.hands.right.closed
                ? "Direita: abra a mão"
                : "Direita livre"}
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
        {!session.tracking.detected && phase !== "lost" && !error && (
          <p class="swing-tracking" role="status">
            Mostre as mãos para a câmera!
          </p>
        )}
        {error ? (
          <section class="swing-panel swing-result" role="alert">
            <h1>A cidade parou</h1>
            <p>Não foi possível desenhar o jogo. Volte ao menu e tente novamente.</p>
          </section>
        ) : (
          !running &&
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
              A mira acompanha a ponta do indicador. Feche o punho para lançar uma teia e mantenha
              fechado para segurar. Abra para soltar.
            </p>
            <p>
              A mira com contorno cheio aponta para um prédio. Se errar, abra a mão e tente de novo.
              Cada mão controla uma teia.
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
      session.tick(now, (side) => scene.ray(session.gestures.hands[side].aim), !help);
      if ((session.physics.phase === "roof" || session.physics.phase === "air") !== running)
        drawUI();
      scene.render(session.physics, now, session.gestures.hands, session.tracking.hands);
    }
    const points: ControlPoint[] = [];
    if (!running && frame && session.hasRecentResult(now) && frame.hands) {
      const bounds = root.getBoundingClientRect();
      for (const hand of frame.hands) {
        if (frame.hands.filter((other) => other.handedness === hand.handedness).length !== 1)
          continue;
        const point = projectHandLandmarks(hand.landmarks)[8];
        if (!point) continue;
        points.push({
          key: hand.handedness,
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
      session.update(next, performance.now());
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
