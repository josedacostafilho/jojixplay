import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { BodyMenu } from "../components/body-menu";
import { CameraBackdrop } from "../components/camera-backdrop";
import { GameView } from "../components/game-view";
import { LensStep } from "../components/lens-step";
import { SetupScreen } from "../components/setup-screen";
import { UnsupportedPanel } from "../components/unsupported-panel";
import type { PoseLimit } from "../domain/pose-limit";
import { type GameId, games } from "../games";
import { inspectLocalPlayCapabilities } from "../platform/capabilities";
import { LocalImmersiveSession } from "../platform/local-immersive-session";
import { Sounds } from "../platform/sounds";
import { useCameraPose } from "../pose/use-camera-pose";

type Screen = { kind: "menu" } | { kind: "game"; game: GameId; players: PoseLimit };

const MENU: Screen = { kind: "menu" };

export function LocalPlayPage() {
  const capabilities = useMemo(inspectLocalPlayCapabilities, []);
  const camera = useCameraPose();
  const [immersive] = useState(() => new LocalImmersiveSession());
  const [sounds] = useState(() => new Sounds());
  const [screen, setScreen] = useState<Screen>(MENU);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  /** The adult has chosen a camera and let go of the phone; only then does the menu appear. */
  const [framed, setFramed] = useState(false);
  const [lensBusy, setLensBusy] = useState(false);
  /** A running game may ask for the camera image behind it. */
  const [cameraShown, setCameraShown] = useState(false);
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
      sounds.stop();
    },
    [immersive, sounds],
  );
  useEffect(() => {
    if (tracking) return;
    trackingRun.current += 1;
    setFramed(false);
    setScreen(MENU);
    setCameraShown(false);
  }, [tracking]);
  useEffect(() => {
    if (camera.state === "error") void immersive.stop();
  }, [camera.state, immersive]);

  function start() {
    setError(null);
    // Fullscreen, orientation lock and audio need this trusted activation.
    immersive.start();
    sounds.start();
    void camera.start();
  }
  function stop() {
    trackingRun.current += 1;
    setScreen(MENU);
    setCameraShown(false);
    camera.stop();
    void immersive.stop();
    sounds.stop();
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

  // Leaving for another app must end the session at once: a hidden page that keeps the camera,
  // the model and its GPU drawing running is wasted heat at best. Coming back starts from the
  // touch screen, which camera access needs anyway.
  const stopWhenHidden = useRef(stop);
  stopWhenHidden.current = stop;
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") stopWhenHidden.current();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
    };
  }, []);

  /** The menu reads bodies, whatever the game was sensing. */
  async function leaveGame(message: string | null) {
    setScreen(MENU);
    setCameraShown(false);
    setError(message);
    if (opening.current) return;
    opening.current = true;
    setPreparing(true);
    try {
      await camera.setSensing("body");
    } catch {
      // The camera reports its own failure and the session returns to the start screen.
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
        visible={!playing || cameraShown}
      />
      {playing ? (
        <section class="game-stage" aria-label={games[playing.game].stageLabel}>
          <GameView
            game={playing.game}
            players={playing.players}
            frames={camera.frames}
            onExit={() => void leaveGame(null)}
            onFailed={() =>
              void leaveGame(`Não foi possível abrir ${games[playing.game].name}. Tente novamente.`)
            }
            onSense={camera.setSensing}
            onShowCamera={setCameraShown}
            camera={() =>
              camera.videoRef.current && camera.normalization
                ? { video: camera.videoRef.current, rotation: camera.normalization.rotation }
                : null
            }
          />
        </section>
      ) : tracking && !framed ? (
        <LensStep
          lenses={camera.lenses}
          lensId={camera.lensId}
          busy={lensBusy}
          error={error}
          onChoose={(lens) => {
            setError(null);
            setLensBusy(true);
            camera
              .setLens(lens)
              .catch(() => setError("Essa câmera não pôde ser aberta. Escolha outra."))
              .finally(() => setLensBusy(false));
          }}
          onDone={() => {
            setError(null);
            setFramed(true);
          }}
          onCancel={stop}
        />
      ) : tracking ? (
        <>
          <BodyMenu
            frames={camera.frames}
            root={root}
            busy={preparing}
            sounds={sounds}
            onOpen={(game, players) => void openGame(game, players)}
            onStop={stop}
          />
          {error ? (
            <p class="inline-error menu-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <SetupScreen
          starting={starting}
          error={camera.errorMessage}
          onStart={start}
          onCancel={stop}
        />
      )}
    </main>
  );
}
