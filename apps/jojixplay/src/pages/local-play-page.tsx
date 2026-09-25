import { BODY_FRESHNESS_MS, isFresh } from "@jojixplay/game-sdk";
import { CameraBackdrop } from "../components/camera-backdrop";
import { GameMenu } from "../components/game-menu";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { MovementNavigation } from "../components/movement-navigation";
import { DrawGame } from "../components/draw-game";
import { UnsupportedPanel } from "../components/unsupported-panel";
import { inspectLocalPlayCapabilities } from "../platform/capabilities";
import { LocalImmersiveSession } from "../platform/local-immersive-session";
import { toBodyFrame } from "../pose/body-frame";
import { useCameraPose } from "../pose/use-camera-pose";

export function LocalPlayPage() {
  const capabilities = useMemo(inspectLocalPlayCapabilities, []);
  const camera = useCameraPose();
  const [immersive] = useState(() => new LocalImmersiveSession());
  const [confirmExit, setConfirmExit] = useState(false);
  const exitDialog = useRef<HTMLDialogElement>(null);
  const [choosingPlayers, setChoosingPlayers] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const opening = useRef(false);
  const [grownups, setGrownups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingPlayers, setChangingPlayers] = useState(false);
  const [stale, setStale] = useState(true);
  const mounted = useRef(true);
  const run = useRef(0);
  const starting = useRef(false);
  const active = camera.state === "tracking";
  const busy = camera.state === "starting";
  const bodyFrame = useMemo(
    () => (camera.packet ? toBodyFrame(camera.packet) : null),
    [camera.packet],
  );

  useEffect(() => {
    if (confirmExit) exitDialog.current?.showModal();
    else exitDialog.current?.close();
  }, [confirmExit]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      void immersive.stop();
    },
    [immersive],
  );

  useEffect(() => {
    if (!active) {
      setDrawing(false);
      setChoosingPlayers(false);
      setConfirmExit(false);
      if (camera.state === "error") void immersive.stop();
      return;
    }

    setStale(!bodyFrame || !isFresh(bodyFrame, performance.now()));
    const remaining = bodyFrame
      ? Math.max(0, BODY_FRESHNESS_MS - (performance.now() - bodyFrame.capturedAtMs))
      : 0;
    const timer = window.setTimeout(() => {
      setStale(true);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, bodyFrame, camera.state, immersive]);

  function stop() {
    setDrawing(false);
    setConfirmExit(false);
    run.current += 1;
    starting.current = false;
    setChangingPlayers(false);
    camera.stop();

    setStale(true);
    void immersive.stop();
  }
  async function start() {
    if (starting.current) return;
    starting.current = true;
    const currentRun = ++run.current;
    setError(null);
    immersive.start();
    const started = await camera.start();
    if (run.current !== currentRun || !mounted.current) return;
    starting.current = false;
    if (!started) void immersive.stop();
  }
  async function openDrawing(players: 1 | 2) {
    if (opening.current || changingPlayers) return;
    opening.current = true;
    const currentRun = run.current;
    setChangingPlayers(true);
    setError(null);
    try {
      if (camera.poseLimit !== players) await camera.setPoseLimit(players);
      if (mounted.current && run.current === currentRun) {
        setGrownups(false);
        setChoosingPlayers(false);
        setDrawing(true);
      }
    } catch {
      if (mounted.current) setError("Não foi possível preparar as pessoas. Tente novamente.");
    } finally {
      opening.current = false;
      if (mounted.current) setChangingPlayers(false);
    }
  }
  if (!capabilities.supported) return <UnsupportedPanel missing={capabilities.missing} />;
  const visible =
    !stale && bodyFrame
      ? bodyFrame.bodies.filter((body) => body.leftWrist || body.rightWrist).length
      : 0;
  const delay = camera.packet ? Math.round(performance.now() - camera.packet.capturedAtMs) : null;
  return (
    <main
      class={`playroom ${active ? "playroom--live" : ""} ${drawing ? "playroom--drawing" : ""}`}
    >
      <CameraBackdrop
        videoRef={camera.videoRef}
        normalization={camera.normalization}
        visible={!drawing}
      />
      <MovementNavigation frame={bodyFrame} active={active} drawing={drawing} onError={setError} />
      <header class="room-header" hidden={drawing}>
        <span class="brand">
          jojix<span>play</span>
          <i aria-hidden="true">✳</i>
        </span>
        <button
          class="parent-button"
          type="button"
          onClick={() => setGrownups(!grownups)}
          aria-expanded={grownups}
        >
          Para os adultos <span aria-hidden="true">↗</span>
        </button>
      </header>
      {active && drawing ? (
        <section class="game-stage" aria-label="Ateliê Desenhar">
          <DrawGame
            frame={stale || grownups || confirmExit ? null : bodyFrame}
            players={camera.poseLimit}
          />
          <button class="game-back" type="button" onClick={() => setConfirmExit(true)}>
            ← Voltar
          </button>
          <dialog class="draw-dialog" ref={exitDialog} onCancel={() => setConfirmExit(false)}>
            <h2>Guardar na imaginação?</h2>
            <p>Ao sair, este desenho será apagado.</p>
            <button type="button" onClick={() => setConfirmExit(false)}>
              Continuar desenhando
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmExit(false);
                setDrawing(false);
                setChoosingPlayers(false);
              }}
            >
              Sair e apagar
            </button>
          </dialog>
        </section>
      ) : active ? (
        <>
          <GameMenu
            choosing={choosingPlayers}
            busy={changingPlayers}
            onChoose={() => {
              setGrownups(false);
              setChoosingPlayers(true);
            }}
            onBack={() => setChoosingPlayers(false)}
            onPlay={(players) => void openDrawing(players)}
          />
          <div class="menu-footer">
            <span class="tracking-note" role="status">
              {visible ? "Achamos você!" : "Mostre as mãos para o celular"}
            </span>
            <button class="quiet-button" type="button" onClick={stop}>
              Encerrar brincadeira
            </button>
          </div>
          {error ? (
            <p class="inline-error menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <section class="welcome" aria-labelledby="welcome-title">
          <div class="welcome-copy">
            <span class="little-label">OI, PEQUENO ARTISTA!</span>
            <h1 id="welcome-title">
              Preparar…
              <br />
              <em>brincar!</em>
            </h1>
            <p>Chame um adulto, apoie o celular e abra espaço para brincar!</p>
            <button
              class="start-button"
              type="button"
              disabled={busy || error !== null}
              onClick={() => void start()}
            >
              {busy ? (
                "Abrindo a câmera…"
              ) : (
                <>
                  Vamos começar <span aria-hidden="true">→</span>
                </>
              )}
            </button>
            <p class="button-caption">Um teste de movimento com a ajuda de um adulto.</p>
            {busy ? (
              <button class="quiet-button" type="button" onClick={stop}>
                Cancelar abertura da câmera
              </button>
            ) : null}
            {camera.errorMessage || error ? (
              <p class="inline-error" role="alert">
                {camera.errorMessage ?? error}
              </p>
            ) : null}
          </div>
          <div class="setup-art" aria-hidden="true">
            <span>✳</span>
            <span>✦</span>
            <span>✎</span>
          </div>
        </section>
      )}
      {!active && (
        <footer class="room-footer">
          <span>
            <b aria-hidden="true">☀</b> Para crianças de 4 a 7 anos
          </span>
          <span>Solte a imaginação. Hoje é dia de desenhar!</span>
        </footer>
      )}
      {grownups ? (
        <section class="parent-panel" aria-label="Orientações para os adultos">
          <div class="parent-heading">
            <h2>Uma ajudinha sua</h2>
            <button
              class="quiet-button"
              type="button"
              onClick={() => setGrownups(false)}
              aria-label="Fechar orientações"
            >
              Fechar ×
            </button>
          </div>
          <div class="parent-scroll-controls">
            <button
              type="button"
              onClick={(event) =>
                event.currentTarget
                  .closest("section")
                  ?.querySelector("ol")
                  ?.scrollBy({ top: -120, behavior: "smooth" })
              }
            >
              ↑ Subir
            </button>
            <button
              type="button"
              onClick={(event) =>
                event.currentTarget
                  .closest("section")
                  ?.querySelector("ol")
                  ?.scrollBy({ top: 120, behavior: "smooth" })
              }
            >
              ↓ Ler mais
            </button>
          </div>
          <ol>
            <li>
              <strong>Prepare um espacinho.</strong> Apoie o celular em um lugar firme, de frente
              para a criança. Deixe ombros e mãos visíveis; os pés podem ficar fora da imagem.
            </li>
            <li>
              <strong>Leve para a TV.</strong> Espelhe a tela usando os controles do celular ou um
              cabo. A brincadeira continua rodando no celular.
            </li>
            <li>
              <strong>Participe.</strong> Escolha Desenhar e depois Sozinho ou Em dupla. Não é
              preciso ter a mesma altura. Vocês podem desenhar juntos, cada um de um lado.
            </li>
            <li>
              <strong>Hora de desenhar.</strong> Uma mão conduz o pincel. Levante a outra acima do
              ombro para pintar e abaixe para parar. Em dupla, cada pessoa fica de um lado. As cores
              podem ser escolhidas mantendo o pincel sobre elas até o círculo completar. Menus,
              voltar e confirmações também funcionam com a mão.
            </li>
          </ol>
          <p>
            Sua câmera aparece nos menus. As imagens ficam neste celular: não gravamos nem enviamos.
          </p>
          {active ? (
            <p class="diagnostic">
              Teste de movimento ·{" "}
              {delay === null ? "Aguardando movimentos" : `${delay} ms desde a captura`} ·{" "}
              {stale
                ? "Sem movimento recente"
                : `${bodyFrame?.bodies.length ?? 0} ${bodyFrame?.bodies.length === 1 ? "pessoa detectada" : "pessoas detectadas"}`}
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
