import { BODY_FRESHNESS_MS, isFresh, type Experience } from "@jojixplay/game-sdk";
import { mountMovementView } from "@jojixplay/movement-view";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { UnsupportedPanel } from "../components/unsupported-panel";
import { inspectLocalPlayCapabilities } from "../platform/capabilities";
import { LocalImmersiveSession } from "../platform/local-immersive-session";
import { toBodyFrame } from "../pose/body-frame";
import { useCameraPose } from "../pose/use-camera-pose";

export function LocalPlayPage() {
  const capabilities = useMemo(inspectLocalPlayCapabilities, []);
  const camera = useCameraPose();
  const [immersive] = useState(() => new LocalImmersiveSession());
  const [grownups, setGrownups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingPlayers, setChangingPlayers] = useState(false);
  const [stale, setStale] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<Experience | null>(null);
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
    mounted.current = true;
    if (container.current && capabilities.supported) {
      try {
        scene.current = mountMovementView(container.current);
      } catch {
        setError(
          "The 3D playground could not open. Reload this page in a browser with WebGL 2 enabled.",
        );
      }
    }
    return () => {
      mounted.current = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [active, capabilities.supported, immersive]);

  useEffect(
    () => () => {
      void immersive.stop();
    },
    [immersive],
  );

  useEffect(() => {
    if (!active) {
      if (camera.state === "error") void immersive.stop();
      return;
    }
    scene.current?.update(bodyFrame);
    setStale(!bodyFrame || !isFresh(bodyFrame, performance.now()));
    const remaining = bodyFrame
      ? Math.max(0, BODY_FRESHNESS_MS - (performance.now() - bodyFrame.capturedAtMs))
      : 0;
    const timer = window.setTimeout(() => {
      setStale(true);
      scene.current?.update(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, bodyFrame, camera.state, immersive]);

  function stop() {
    run.current += 1;
    starting.current = false;
    setChangingPlayers(false);
    camera.stop();
    scene.current?.update(null);
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
  async function changePlayers() {
    const currentRun = run.current;
    setChangingPlayers(true);
    setError(null);
    try {
      await camera.setPoseLimit(camera.poseLimit === 1 ? 2 : 1);
    } catch (reason) {
      if (mounted.current && run.current === currentRun)
        setError(reason instanceof Error ? reason.message : "Could not change players.");
    } finally {
      if (mounted.current && run.current === currentRun) setChangingPlayers(false);
    }
  }
  if (!capabilities.supported) return <UnsupportedPanel missing={capabilities.missing} />;
  const visible =
    !stale && bodyFrame
      ? bodyFrame.bodies.filter((body) => body.leftWrist || body.rightWrist).length
      : 0;
  const delay = camera.packet ? Math.round(performance.now() - camera.packet.capturedAtMs) : null;
  return (
    <main class={`playroom ${active ? "playroom--live" : ""}`}>
      <video
        ref={camera.videoRef}
        class="local-camera-source"
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      />
      <header class="room-header">
        <a class="brand" href={import.meta.env.BASE_URL} aria-label="JojixPlay home">
          jojix<span>play</span>
          <i aria-hidden="true">✳</i>
        </a>
        <button
          class="parent-button"
          type="button"
          onClick={() => setGrownups(!grownups)}
          aria-expanded={grownups}
        >
          For grown-ups <span aria-hidden="true">↗</span>
        </button>
      </header>
      <section class="welcome" aria-labelledby="welcome-title">
        <div class="welcome-copy">
          <span class="little-label">HELLO, LITTLE MOVER</span>
          <h1 id="welcome-title">
            {active ? (
              <>
                Hello,
                <br />
                <em>wiggly you!</em>
              </>
            ) : (
              <>
                Ready, set…
                <br />
                <em>wiggle!</em>
              </>
            )}
          </h1>
          <p>
            {active
              ? "Give us a wave. Your hands can play even when your feet are out of the picture."
              : "Find a comfy spot with your grown-up. Then give us a wave!"}
          </p>
          {active ? (
            <div class="live-actions">
              <span class={`tracking-note ${visible ? "tracking-note--seen" : ""}`} role="status">
                {visible ? "There you are!" : "Wave in front of the phone"}
              </span>
              <button
                class="secondary-button"
                type="button"
                disabled={changingPlayers}
                onClick={() => void changePlayers()}
              >
                {changingPlayers
                  ? "One moment…"
                  : camera.poseLimit === 1
                    ? "Add a grown-up · 2 people"
                    : "Just me · 1 person"}
              </button>
              <button class="quiet-button" type="button" onClick={stop}>
                Finish movement check
              </button>
            </div>
          ) : (
            <>
              <button
                class="start-button"
                type="button"
                disabled={busy || error !== null}
                onClick={() => void start()}
              >
                {busy ? (
                  "Waking up the camera…"
                ) : (
                  <>
                    Let’s get ready <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
              <p class="button-caption">A little movement check, with your grown-up.</p>
              {busy ? (
                <button class="quiet-button" type="button" onClick={stop}>
                  Cancel camera startup
                </button>
              ) : null}
            </>
          )}
          {camera.errorMessage || error ? (
            <p class="inline-error" role="alert">
              {camera.errorMessage ?? error}
            </p>
          ) : null}
        </div>
        <div class="wonder-world">
          <div class="world-orbit" aria-hidden="true" />
          <span class="world-spark spark-one" aria-hidden="true">
            ✳
          </span>
          <span class="world-spark spark-two" aria-hidden="true">
            ✦
          </span>
          <div class="movement-scene" ref={container} />
          <span class="world-caption">
            {active ? "Your moves, a little magic." : "Better together."}
          </span>
        </div>
      </section>
      <footer class="room-footer">
        <span>
          <b aria-hidden="true">☀</b> Made for little movers, ages 4–7
        </span>
        <span>Our games are growing. Today, explore your moves.</span>
      </footer>
      {grownups ? (
        <section class="parent-panel" aria-label="Grown-up settings">
          <div class="parent-heading">
            <h2>A hand from you</h2>
            <button
              class="quiet-button"
              type="button"
              onClick={() => setGrownups(false)}
              aria-label="Close grown-up settings"
            >
              Close ×
            </button>
          </div>
          <ol>
            <li>
              <strong>Make a little space.</strong> Put the phone somewhere steady, facing your
              child. Keep their shoulders and hands in view; feet can be outside the picture.
            </li>
            <li>
              <strong>Make it bigger.</strong> Mirror this phone to your TV using your phone’s
              screen-mirroring controls or a cable. Everything runs here.
            </li>
            <li>
              <strong>Join in.</strong> Start the movement check, then add a second person. You
              don’t need to be the same height.
            </li>
          </ol>
          <p>Camera images stay on this phone. We don’t show, record or send them.</p>
          {active ? (
            <p class="diagnostic">
              Tracking check · Full / GPU ·{" "}
              {delay === null ? "Waiting for input" : `${delay} ms since capture`} ·{" "}
              {stale ? "No fresh input" : `${bodyFrame?.bodies.length ?? 0} body observations`}
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
