import { isFresh } from "@jojixplay/game-sdk";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CameraBackdrop } from "../components/camera-backdrop";
import { GameMenu } from "../components/game-menu";
import { GameView } from "../components/game-view";
import { MenuPointers } from "../components/menu-pointers";
import { ParentPanel } from "../components/parent-panel";
import { UnsupportedPanel } from "../components/unsupported-panel";
import { usePolled } from "../components/use-polled";
import type { PoseLimit } from "../domain/pose-limit";
import { type GameId, games } from "../games";
import { inspectLocalPlayCapabilities } from "../platform/capabilities";
import { LocalImmersiveSession } from "../platform/local-immersive-session";
import type { BodyFrameSource } from "../pose/body-frame-source";
import { useCameraPose } from "../pose/use-camera-pose";

type Screen =
  | { kind: "menu" }
  | { kind: "players" }
  | { kind: "game"; game: GameId; players: PoseLimit };

const MENU: Screen = { kind: "menu" };

function TrackingNote({ frames }: { frames: BodyFrameSource }) {
  const handsVisible = usePolled(() => {
    const frame = frames.latest();
    return (
      !!frame &&
      isFresh(frame, performance.now()) &&
      frame.bodies.some((body) => body.leftWrist || body.rightWrist)
    );
  }, 200);
  return (
    <span class="tracking-note" role="status">
      {handsVisible ? "Achamos você!" : "Mostre as mãos para o celular"}
    </span>
  );
}

export function LocalPlayPage() {
  const capabilities = useMemo(inspectLocalPlayCapabilities, []);
  const camera = useCameraPose();
  const [immersive] = useState(() => new LocalImmersiveSession());
  const [screen, setScreen] = useState<Screen>(MENU);
  const [grownups, setGrownups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const root = useRef<HTMLElement>(null);
  /** Advances whenever tracking ends, so a late player-mode change cannot open a game. */
  const trackingRun = useRef(0);
  const opening = useRef(false);
  const tracking = camera.state === "tracking";
  const starting = camera.state === "starting";
  const playing = tracking && screen.kind === "game" ? screen : null;

  useEffect(
    () => () => {
      void immersive.stop();
    },
    [immersive],
  );
  useEffect(() => {
    if (tracking) return;
    trackingRun.current += 1;
    setScreen(MENU);
  }, [tracking]);
  useEffect(() => {
    if (camera.state === "error") void immersive.stop();
  }, [camera.state, immersive]);

  function start() {
    setError(null);
    // Fullscreen and orientation lock need this trusted activation.
    immersive.start();
    void camera.start();
  }
  function stop() {
    trackingRun.current += 1;
    setScreen(MENU);
    camera.stop();
    void immersive.stop();
  }
  async function openGame(game: GameId, players: PoseLimit) {
    if (opening.current) return;
    opening.current = true;
    const run = trackingRun.current;
    setPreparing(true);
    setError(null);
    try {
      // Two-person play is shown only after the camera has applied it.
      if (camera.poseLimit !== players) await camera.setPoseLimit(players);
      if (trackingRun.current === run) {
        setGrownups(false);
        setScreen({ kind: "game", game, players });
      }
    } catch {
      if (trackingRun.current === run)
        setError("Não foi possível preparar as pessoas. Tente novamente.");
    } finally {
      opening.current = false;
      setPreparing(false);
    }
  }

  if (!capabilities.supported) return <UnsupportedPanel missing={capabilities.missing} />;
  return (
    <main
      ref={root}
      class={`playroom ${tracking ? "playroom--live" : ""} ${playing ? "playroom--game" : ""}`}
    >
      <CameraBackdrop
        videoRef={camera.videoRef}
        normalization={camera.normalization}
        visible={!playing}
      />
      {tracking && !playing ? <MenuPointers frames={camera.frames} root={root} /> : null}
      <header class="room-header" hidden={playing !== null}>
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
      {playing ? (
        <section class="game-stage" aria-label={games[playing.game].stageLabel}>
          <GameView
            game={playing.game}
            players={playing.players}
            frames={camera.frames}
            onExit={() => setScreen(MENU)}
            onFailed={() => {
              setScreen(MENU);
              setError(`Não foi possível abrir ${games[playing.game].name}. Tente novamente.`);
            }}
          />
        </section>
      ) : tracking ? (
        <>
          <GameMenu
            choosing={screen.kind === "players"}
            busy={preparing}
            onChoose={() => {
              setGrownups(false);
              setScreen({ kind: "players" });
            }}
            onBack={() => setScreen(MENU)}
            onPlay={(players) => void openGame("desenhar", players)}
            onRace={() => void openGame("corrida", 1)}
          />
          <div class="menu-footer">
            <TrackingNote frames={camera.frames} />
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
        <>
          <section class="welcome" aria-labelledby="welcome-title">
            <div class="welcome-copy">
              <span class="little-label">OI, TURMINHA!</span>
              <h1 id="welcome-title">
                Preparar…
                <br />
                <em>brincar!</em>
              </h1>
              <p>Chame um adulto, apoie o celular e abra espaço para brincar!</p>
              <button class="start-button" type="button" disabled={starting} onClick={start}>
                {starting ? (
                  "Abrindo a câmera…"
                ) : (
                  <>
                    Vamos começar <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
              <p class="button-caption">Um teste de movimento com a ajuda de um adulto.</p>
              {starting ? (
                <button class="quiet-button" type="button" onClick={stop}>
                  Cancelar abertura da câmera
                </button>
              ) : null}
              {camera.errorMessage ? (
                <p class="inline-error" role="alert">
                  {camera.errorMessage}
                </p>
              ) : null}
            </div>
            <div class="setup-art" aria-hidden="true">
              <span>✳</span>
              <span>✦</span>
              <span>✎</span>
            </div>
          </section>
          <footer class="room-footer">
            <span>
              <b aria-hidden="true">☀</b> Para crianças de 4 a 7 anos
            </span>
            <span>Solte a imaginação. Hoje é dia de brincar!</span>
          </footer>
        </>
      )}
      {grownups ? (
        <ParentPanel frames={tracking ? camera.frames : null} onClose={() => setGrownups(false)} />
      ) : null}
    </main>
  );
}
