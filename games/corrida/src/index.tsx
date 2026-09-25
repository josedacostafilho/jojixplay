import {
  isFresh,
  mountMovementControls,
  type BodyFrame,
  type ControlPoint,
  type Experience,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { poseLabels } from "./movement";
import { createScene } from "./scene";
import { LEVEL_STARTS, RaceSession, RUN_SECONDS } from "./session";
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
      <span class="race-eyebrow">
        {mode === "help" ? "CADA MOVIMENTO É UMA AVENTURA" : "UMA RESPIRADA"}
      </span>
      <h2>{mode === "help" ? "Seu corpo joga!" : "A pista espera por você"}</h2>
      {mode === "help" ? (
        <div class="race-help-grid">
          <div>
            <ActionIcon kind="jump" />
            <strong>Pule</strong>
            <p>Salte quando a barreira chegar.</p>
          </div>
          <div>
            <ActionIcon kind="wall" />
            <strong>Copie</strong>
            <p>Seu boneco está no muro. Acerte os braços e mantenha o verde até passar!</p>
          </div>
          <div>
            <ActionIcon kind="duck" />
            <strong>Agache</strong>
            <p>Abaixe para passar por baixo.</p>
          </div>
        </div>
      ) : (
        <p>Mexa a mão até o botão e espere o círculo completar.</p>
      )}
      <p class="race-small">Cada fase renova seus 3 corações. Sem corações, a corrida termina.</p>
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
        <div class="race-brand">
          <span aria-hidden="true">▰</span>
          <div>
            CORRIDA<small>DOS BLOCOS</small>
          </div>
        </div>
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
          <span class="race-eyebrow">SEU CORPO. SUA AVENTURA.</span>
          <h1>
            Pronto para
            <br />
            <em>ir mais longe?</em>
          </h1>
          <p>
            Venha para o meio e <strong>agache para começar.</strong>
          </p>
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
                      : "Agache e segure a posição"}
              </strong>
              <small>Deixe espaço para pular e os pés à vista.</small>
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
          <span class="race-start-meta">
            1 pessoa <i /> 3 fases <i /> 5 minutos
          </span>
        </section>
      )}
      {levelIntro && (
        <div class="race-level" role="status" key={s.level}>
          <span>FASE {s.level} / 3</span>
          <strong>
            {s.level === 1 ? "Bora pular!" : s.level === 2 ? "Entre na pose!" : "Abaixa e vai!"}
          </strong>
          <small>
            {s.level === 1
              ? "Pule as barreiras"
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
        until > -0.7 && (
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
                    ? "Pule!"
                    : "Agache!"}
              </strong>
              <small>
                {obstacle.kind === "wall"
                  ? "Combine seu boneco com o desenho"
                  : "Quando chegar pertinho"}
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
          <span>{feedback.success ? "+100" : "Na próxima você consegue"}</span>
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
          <span class="race-trophy" aria-hidden="true">
            {s.phase === "won" ? "★" : "⚑"}
          </span>
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
            Não foi possível continuar o desenho da pista. Volte ao menu e abra a corrida novamente.
          </p>
        </section>
      )}
      <footer class="race-route">
        <span>
          FASE {s.level}
          <small>{["PULAR", "COPIAR", "AGACHAR"][s.level - 1]}</small>
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
    error = false;
  const controls = mountMovementControls(root, () => true, "target");
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
      <RaceUI
        session={session}
        modal={modal}
        error={error}
        onModal={onModal}
        onReplay={onReplay}
      />,
      ui,
    );
  }
  const contextLost = (event: Event) => {
    event.preventDefault();
    error = true;
    controls.reset();
    drawUI();
  };
  world.querySelector("canvas")?.addEventListener("webglcontextlost", contextLost);
  function tick(now: number) {
    if (disposed) return;
    session.tick(now, frame, !!modal || document.hidden || error);
    const points: ControlPoint[] = [];
    if (frame && isFresh(frame, now) && frame.bodies.length === 1) {
      const r = root.getBoundingClientRect();
      for (const side of ["left", "right"] as const) {
        const wrist = frame.bodies[0]?.[`${side}Wrist`];
        if (wrist)
          points.push({
            key: side,
            x: r.left + (1 - wrist.x) * r.width,
            y: r.top + wrist.y * r.height,
          });
      }
    }
    controls.update(points, now);
    if (!error) scene.render(session, now);
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
