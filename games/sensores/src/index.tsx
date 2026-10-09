import {
  cameraCover,
  type Experience,
  type Frame,
  type GameHost,
  isFresh,
  mountMovementControls,
  type Sensing,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { coverage, type Figures, figures, pointers, silhouettePointer } from "./figures";
import { createOverlay } from "./overlay";
import { createSilhouetteLayer } from "./silhouette-layer";
import "./style.css";

/** Leaving takes a deliberate hold, so no confirmation is asked. */
const EXIT_HOLD_MS = 2000;
const STATUS_INTERVAL_MS = 500;
/**
 * A game ignores a reading older than the SDK's freshness limit. The bench keeps drawing a slow
 * one, marked as late, until readings stop arriving for this long: slowness is what it is for.
 */
const SILENCE_MS = 1000;
const NOTHING: Figures = { segments: [], dots: [], labels: [] };

const modes: ReadonlyArray<{ label: string; mode: Sensing | null }> = [
  { label: "Corpo", mode: "body" },
  { label: "Mãos", mode: "hands" },
  { label: "Silhueta", mode: "silhouette" },
  // Not built yet: the bench keeps its place.
  { label: "Corpo + silhueta", mode: null },
];
function count(amount: number, one: string, many: string) {
  return `${amount} ${amount === 1 ? one : many}`;
}

function Bench({
  mode,
  switching,
  camera,
  status,
  onMode,
  onCamera,
  onExit,
}: {
  mode: Sensing;
  switching: boolean;
  camera: boolean;
  status: string;
  onMode: (mode: Sensing) => void;
  onCamera: () => void;
  onExit: () => void;
}) {
  return (
    <>
      <div class="sense-modes" role="toolbar" aria-label="Sensor">
        {modes.map((entry) => (
          <button
            key={entry.label}
            type="button"
            disabled={entry.mode === null || switching}
            aria-pressed={entry.mode === mode}
            onClick={() => entry.mode && onMode(entry.mode)}
          >
            {entry.label}
            {entry.mode === null ? <small>em breve</small> : null}
          </button>
        ))}
      </div>
      <div class="sense-corner">
        <button type="button" onClick={onCamera}>
          {camera ? "Ver fundo" : "Ver câmera"}
        </button>
        <button type="button" data-dwell-ms={EXIT_HOLD_MS} onClick={onExit}>
          Voltar
        </button>
      </div>
      <p class="sense-status" role="status">
        {status}
      </p>
    </>
  );
}

/**
 * The owner's bench for looking at what each kind of sensing produces: the figure the host
 * sensed, drawn over the camera image or over a plain background. It interprets nothing.
 */
export function mountSensores(container: HTMLElement, host: GameHost): Experience<Frame> {
  const root = document.createElement("section");
  root.className = "sense-game";
  root.setAttribute("aria-label", "Bancada de sensores");
  const overlay = createOverlay(root);
  const ui = document.createElement("div");
  ui.className = "sense-ui";
  root.append(ui);
  container.append(root);

  let sensing: Sensing = "body";
  let switching = false;
  /** Made on first use: only silhouettes need a WebGL context. */
  let layer: ReturnType<typeof createSilhouetteLayer> | null = null;
  let layerDrawn = false;
  let layerFailed = false;
  let camera = true;
  let frame: Frame | null = null;
  let disposed = false;
  let request = 0;
  let drawn: unknown = null;
  let arrivals: Array<{ at: number; delay: number }> = [];
  let arrivedAt = -Infinity;
  let statusAt = -Infinity;
  // The cursor would hide the very fingertip being inspected, so it shows only over a button.
  const controls = mountMovementControls(root, { pointer: "target" });

  function status(now: number) {
    if (switching) return "Trocando o sensor…";
    if (!frame || frame.sensing !== sensing || now - arrivedAt > SILENCE_MS || !arrivals.length)
      return "Sem leitura";
    const seen = frame.silhouette
      ? layerFailed
        ? "sem WebGL para desenhar a silhueta"
        : `silhueta em ${Math.round(coverage(frame.silhouette) * 100)}% da imagem`
      : sensing === "hands"
        ? count(frame.hands.length, "mão", "mãos")
        : count(frame.bodies.length, "pessoa", "pessoas");
    const delay = arrivals.reduce((sum, arrival) => sum + arrival.delay, 0) / arrivals.length;
    const late = isFresh(frame, now) ? "" : " · atrasada";
    return `${seen} · ${count(arrivals.length, "leitura", "leituras")}/s · ${Math.round(delay)} ms${late}`;
  }
  function drawUI(now: number) {
    statusAt = now;
    root.classList.toggle("sense-game--camera", camera);
    render(
      <Bench
        mode={sensing}
        switching={switching}
        camera={camera}
        status={status(now)}
        onMode={sense}
        onCamera={() => {
          camera = !camera;
          drawn = null;
          host.showCamera(camera);
          drawUI(performance.now());
        }}
        onExit={host.exit}
      />,
      ui,
    );
  }
  function sense(next: Sensing) {
    if (switching || next === sensing) return;
    sensing = next;
    switching = true;
    arrivals = [];
    controls.reset();
    drawUI(performance.now());
    const settle = () => {
      if (disposed) return;
      switching = false;
      drawUI(performance.now());
    };
    // When the host cannot apply it, the host ends the session and this bench is disposed.
    void host.sense(next).then(settle, settle);
  }
  function tick(now: number) {
    if (disposed) return;
    const current =
      !switching && frame?.sensing === sensing && now - arrivedAt <= SILENCE_MS ? frame : null;
    if (current) {
      const cover = cameraCover(current.width, current.height, innerWidth, innerHeight);
      // A new reading or a resized viewport moves the figure; nothing else does.
      const key = `${current.epoch}:${current.sequence}:${innerWidth}:${innerHeight}`;
      if (key !== drawn) overlay.draw(figures(current, cover));
      const { silhouette } = current;
      if (silhouette) {
        if (!layer && !layerFailed) {
          try {
            layer = createSilhouetteLayer(root);
          } catch {
            layerFailed = true;
          }
        }
        // Over the camera image the tint changes only with a new reading. The cut-out shows live
        // camera pixels through the latest silhouette, so it is redrawn on every screen frame.
        if (layer && (key !== drawn || !camera)) {
          layer.draw(silhouette, cover, !camera, host.camera());
          layerDrawn = true;
        }
      }
      drawn = key;
      // Buttons are pressed only by a fresh reading, as in any game.
      const points = !isFresh(current, now)
        ? []
        : silhouette
          ? [
              silhouettePointer(
                silhouette,
                cover,
                Array.from(root.querySelectorAll("button:enabled"), (button) =>
                  button.getBoundingClientRect(),
                ),
              ),
            ]
          : pointers(current, cover);
      controls.update(points, now);
    } else {
      if (drawn !== null) overlay.draw(NOTHING);
      drawn = null;
      controls.update([], now);
    }
    if (layerDrawn && !current?.silhouette) {
      layer?.clear();
      layerDrawn = false;
    }
    arrivals = arrivals.filter((arrival) => now - arrival.at < 1000);
    if (now - statusAt >= STATUS_INTERVAL_MS) drawUI(now);
    request = requestAnimationFrame(tick);
  }

  host.showCamera(camera);
  drawUI(performance.now());
  request = requestAnimationFrame(tick);
  return {
    update(next) {
      if (!next || next.epoch !== frame?.epoch) controls.reset();
      if (next && next.sequence !== frame?.sequence) {
        arrivedAt = performance.now();
        arrivals.push({ at: arrivedAt, delay: arrivedAt - next.capturedAtMs });
      }
      frame = next;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      controls.dispose();
      render(null, ui);
      layer?.dispose();
      overlay.dispose();
      root.remove();
    },
  };
}
