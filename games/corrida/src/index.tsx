import {
  isFresh,
  mountMovementControls,
  reachableHand,
  type BodyFrame,
  type ControlPoint,
  type Experience,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { poseLabels } from "./movement";
import { createScene } from "./scene";
import { JUMP_WINDOW, LEVEL_STARTS, RaceSession, RUN_SECONDS } from "./session";
import "./style.css";

function ActionIcon({ kind }: { kind: "jump" | "duck" | "wall" }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle
        cx={kind === "duck" ? 37 : 32}
        cy={kind === "duck" ? 23 : 12}
        r="6"
        fill="currentColor"
      />
      <path
        d={
          kind === "jump"
            ? "M32 24 32 37 M32 25 14 16 M32 25 50 16 M32 37 20 48 13 42 M32 37 45 48 52 40"
            : kind === "duck"
              ? "M32 32 23 38 40 44 29 54 M29 34 47 36 M24 39 17 53 11 53"
              : "M32 24 32 39 M12 25 52 25 M32 39 22 55 M32 39 42 55"
        }
        stroke="currentColor"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
function Modal({ mode, onClose }: { mode: "pause" | "help"; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} class="race-dialog" onCancel={onClose}>
      <h2>{mode === "help" ? "Seu corpo joga!" : "A pista espera por você"}</h2>
      {mode === "help" ? (
        <div class="race-help-grid">
          <div>
            <ActionIcon kind="duck" />
            <strong>Agache</strong>
            <p>Abaixe quando o tronco chegar.</p>
          </div>
          <div>
            <ActionIcon kind="wall" />
            <strong>Copie</strong>
            <p>Copie os braços. Segure o verde!</p>
          </div>
          <div>
            <ActionIcon kind="jump" />
            <strong>Pule</strong>
            <p>Dê um pulinho. Vale só fazer o movimento!</p>
          </div>
        </div>
      ) : (
        <p>Leve o círculo da mão até uma escolha e segure.</p>
      )}
      <button type="button" onClick={onClose}>
        Vamos nessa →
      </button>
    </dialog>
  );
}
function RaceUI({
  session: s,
  modal,
  error,
  onModal,
  onReplay,
}: {
  session: RaceSession;
  modal: "pause" | "help" | null;
  error: boolean;
  onModal: (mode: "pause" | "help" | null) => void;
  onReplay: () => void;
}) {
  const ready = s.phase === "ready" || s.phase === "countdown";
  const finished = s.phase === "won" || s.phase === "lost";
  const obstacle = s.next;
  const until = obstacle ? obstacle.at - s.elapsed : 100;
  const feedback = s.feedback && s.feedback.until > s.elapsed && !ready ? s.feedback : null;
  const levelStart = LEVEL_STARTS[s.level - 1] ?? 0;
  const levelIntro = !ready && !finished && s.elapsed - levelStart < 3.5;
  const trackingPaused = s.phase === "running" && (!s.tracking || s.recovering) && !modal;
  const seconds = Math.max(0, Math.ceil(RUN_SECONDS - s.elapsed));
  return (
    <div class={`race-ui ${feedback && !feedback.success ? "race-ui--miss" : ""}`}>
      <header class="race-hud">
        <div class="race-score">
          <small>PONTOS</small>
          <strong>{s.score.toLocaleString("pt-BR")}</strong>
        </div>
        <div class="race-hearts" role="img" aria-label={`${s.lives} vidas`}>
          <span aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} class={i >= s.lives ? "empty" : ""}>
                ♥
              </span>
            ))}
          </span>
        </div>
      </header>
      <p class="race-control-hint">Mova a mão • segure no botão</p>
      <nav class="race-tools" aria-label="Controles da corrida">
        <button type="button" onClick={() => onModal("pause")}>
          Ⅱ Pausa
        </button>
        <button type="button" onClick={() => onModal("help")}>
          ? Como jogar
        </button>
      </nav>
      {ready && !error && (
        <section class="race-start" aria-label="Preparar corrida">
          <h1>Agache para começar</h1>
          <div class="race-start-cue">
            <ActionIcon kind="duck" />
            <div>
              <strong>
                {s.phase === "countdown"
                  ? "Isso! Continue agachado"
                  : !s.tracking
                    ? "Fique de frente para o celular"
                    : !s.movement.centered
                      ? "Um pouquinho mais para o meio"
                      : "No meio, segure por 3 segundos"}
              </strong>
            </div>
          </div>
          {s.phase === "countdown" && (
            <div class="race-countdown" style={{ "--count": `${s.countdown / 30}%` }} role="status">
              <b key={Math.ceil((3000 - s.countdown) / 1000)}>
                {Math.max(1, Math.ceil((3000 - s.countdown) / 1000))}
              </b>
              <span>SEGURA AÍ…</span>
            </div>
          )}
        </section>
      )}
      {levelIntro && (
        <div class="race-level" role="status" key={s.level}>
          <span>FASE {s.level} / 3</span>
          <strong>
            {s.level === 1 ? "Abaixa e vai!" : s.level === 2 ? "Entre na pose!" : "Bora pular!"}
          </strong>
          <small>
            {s.level === 1
              ? "Passe por baixo dos troncos"
              : s.level === 2
                ? "Agora também tem muros de poses"
                : "Novos obstáculos · corações renovados"}
          </small>
        </div>
      )}
      {!ready &&
        !finished &&
        !levelIntro &&
        !trackingPaused &&
        obstacle &&
        until < 5.5 &&
        until > -1.1 && (
          <div
            class={`race-action ${s.matching && obstacle.kind === "wall" ? "race-action--matched" : ""}`}
          >
            <ActionIcon kind={obstacle.kind} />
            <div>
              <strong>
                {obstacle.kind === "wall"
                  ? s.matching
                    ? "Isso! Segure a pose"
                    : poseLabels[obstacle.pose]
                  : obstacle.kind === "jump"
                    ? until > JUMP_WINDOW
                      ? "Prepare o pulinho"
                      : "Pule!"
                    : "Agache!"}
              </strong>
              <small>
                {obstacle.kind === "wall"
                  ? "Combine seu boneco com o desenho"
                  : obstacle.kind === "jump"
                    ? "Vale um pulinho de mentirinha"
                    : "Passe por baixo do tronco"}
              </small>
            </div>
          </div>
        )}
      {feedback && !finished && (
        <div
          class={`race-feedback ${feedback.success ? "race-feedback--yes" : "race-feedback--no"}`}
          role="status"
          key={feedback.id}
        >
          <b>{feedback.success ? "Boa!" : "Ops!"}</b>
          <span>{feedback.success ? "+100" : "Tente o próximo!"}</span>
        </div>
      )}
      {trackingPaused && (
        <div class="race-tracking" role="status">
          <strong>{s.tracking ? "Achamos você!" : "Cadê você?"}</strong>
          <span>
            {s.tracking
              ? "Preparando para continuar…"
              : "Volte para o meio. A corrida está esperando."}
          </span>
        </div>
      )}
      {!ready && !finished && s.elapsed > 291 && (
        <div class="race-finish-cue">A chegada está logo ali! ✦</div>
      )}
      {finished && (
        <section
          class={`race-result ${s.phase === "won" ? "race-result--won" : ""}`}
          aria-label="Resultado da corrida"
        >
          <span class="race-eyebrow">
            {s.phase === "won" ? "VOCÊ CRUZOU A CHEGADA" : `VOCÊ CHEGOU À FASE ${s.level}`}
          </span>
          <h1>{s.phase === "won" ? "Que corrida!" : "Valeu a aventura!"}</h1>
          <div class="race-total">
            {s.score.toLocaleString("pt-BR")}
            <small>PONTOS</small>
          </div>
          <p>
            {s.cleared} obstáculos superados · {Math.floor(s.elapsed / 60)}:
            {String(Math.floor(s.elapsed % 60)).padStart(2, "0")} de aventura
          </p>
          <button type="button" onClick={onReplay}>
            Correr de novo ↻
          </button>
          <small>Para escolher outro jogo, use Voltar.</small>
        </section>
      )}
      {error && (
        <section class="race-result" role="alert">
          <h1>A pista parou</h1>
          <p>
            Não foi possível carregar ou desenhar a pista. Volte ao menu e abra a corrida novamente.
          </p>
        </section>
      )}
      <footer class="race-route">
        <span>
          FASE {s.level}
          <small>{["AGACHAR", "COPIAR", "PULAR"][s.level - 1]}</small>
        </span>
        <div
          class="race-progress"
          role="progressbar"
          aria-label="Percurso"
          aria-valuemin={0}
          aria-valuemax={300}
          aria-valuenow={Math.floor(s.elapsed)}
        >
          <i style={{ width: `${s.elapsed / 3}%` }} />
          <b style={{ left: "20%" }} />
          <b style={{ left: "50%" }} />
          <span aria-hidden="true">⚑</span>
        </div>
        <time>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </time>
      </footer>
      {modal && <Modal mode={modal} onClose={() => onModal(null)} />}
    </div>
  );
}
export function mountCorrida(container: HTMLElement): Experience {
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
  let session = new RaceSession(),
    frame: BodyFrame | null = null,
    modal: "pause" | "help" | null = null;
  let request = 0,
    lastUI = -Infinity,
    disposed = false,
    loaded = false,
    error = false;
  const controls = mountMovementControls(root);
  const onModal = (next: typeof modal) => {
    modal = next;
    controls.reset();
    drawUI();
  };
  const onReplay = () => {
    session = new RaceSession();
    controls.reset();
    drawUI();
  };
  function drawUI() {
    render(
      !loaded && !error ? (
        <p class="race-loading" role="status">
          Preparando a floresta…
        </p>
      ) : (
        <RaceUI
          session={session}
          modal={modal}
          error={error}
          onModal={onModal}
          onReplay={onReplay}
        />
      ),
      ui,
    );
  }
  world.hidden = true;
  void scene.ready
    .then(() => {
      if (disposed) return;
      loaded = true;
      world.hidden = false;
      drawUI();
    })
    .catch(() => {
      if (disposed) return;
      error = true;
      scene.dispose();
      drawUI();
    });
  const contextLost = (event: Event) => {
    event.preventDefault();
    error = true;
    controls.reset();
    drawUI();
  };
  world.querySelector("canvas")?.addEventListener("webglcontextlost", contextLost);
  function tick(now: number) {
    if (disposed) return;
    session.tick(now, frame, !!modal || document.hidden || error || !loaded);
    const points: ControlPoint[] = [];
    if (frame && isFresh(frame, now) && frame.bodies.length === 1) {
      const r = root.getBoundingClientRect();
      for (const side of ["left", "right"] as const) {
        const wrist = frame.bodies[0]?.[`${side}Wrist`];
        if (wrist) {
          const point = reachableHand(wrist.x, wrist.y);
          points.push({
            key: side,
            x: r.left + point.x * r.width,
            y: r.top + point.y * r.height,
          });
        }
      }
    }
    controls.update(points, now);
    if (loaded && !error) scene.render(session, now);
    if (now - lastUI >= 80) {
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
      world.querySelector("canvas")?.removeEventListener("webglcontextlost", contextLost);
      render(null, ui);
      scene.dispose();
      root.remove();
    },
  };
}
