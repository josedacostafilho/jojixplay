import {
  type ControlPoint,
  cameraCover,
  isFresh,
  mountMovementControls,
} from "@jojixplay/game-sdk";
import type { ComponentChildren, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { type BodyAnchor, findAnchor, menuLayout } from "../domain/body-anchor";
import { estimateIndexPoint } from "../domain/camera-view";
import type { PoseLimit } from "../domain/pose-limit";
import { type GameId, gameIds, games } from "../games";
import type { Sounds } from "../platform/sounds";
import type { FrameSource } from "../pose/frame-source";
import { usePolled } from "./use-polled";

/** Objects stay where they were through a brief loss of the shoulders, then disappear. */
const ANCHOR_HOLD_MS = 400;
/** Holding a side bubble keeps turning the shelf at this pace. */
const TURN_REPEAT_MS = 900;
const EXIT_HOLD_MS = 2000;

function Icon({ children, box = "0 0 100 100" }: { children: ComponentChildren; box?: string }) {
  return (
    <svg
      viewBox={box}
      fill="none"
      stroke="currentColor"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
const onePerson = (
  <>
    <circle cx="50" cy="22" r="12" />
    <path d="M50 34 L50 64 M50 44 L30 32 M50 44 L70 32 M50 64 L38 90 M50 64 L62 90" />
  </>
);
const twoPeople = (
  <>
    <circle cx="32" cy="22" r="11" />
    <path d="M32 33 L32 62 M32 43 L16 32 M32 43 L48 50 M32 62 L23 90 M32 62 L41 90" />
    <circle cx="72" cy="32" r="9" />
    <path d="M72 41 L72 66 M72 50 L88 40 M72 50 L56 54 M72 66 L65 90 M72 66 L79 90" />
  </>
);

function Diagnostic({ frames }: { frames: FrameSource }) {
  const text = usePolled(() => {
    const now = performance.now();
    const frame = frames.latest();
    if (!frame) return "Aguardando movimentos";
    const people = frame.bodies.length;
    return `${Math.round(now - frame.capturedAtMs)} ms desde a captura · ${
      isFresh(frame, now) ? `${people} ${people === 1 ? "pessoa" : "pessoas"}` : "sem movimento"
    }`;
  }, 500);
  return <p class="menu-diagnostic">{text}</p>;
}

/**
 * The game menu lives around the player's body in the fullscreen mirror: the game in focus floats
 * above the head and one bubble sits at arm's length on each side. Hanging arms reach nothing.
 * Raising a hand to the card plays it; stretching an arm to a bubble turns the shelf.
 */
export function BodyMenu({
  frames,
  root,
  busy,
  sounds,
  onOpen,
  onStop,
}: {
  frames: FrameSource;
  root: RefObject<HTMLElement>;
  busy: boolean;
  sounds: Sounds;
  onOpen: (game: GameId, players: PoseLimit) => void;
  onStop: () => void;
}) {
  const [focus, setFocus] = useState(0);
  const [choosing, setChoosing] = useState<GameId | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const at = (offset: number) =>
    gameIds[(((focus + offset) % gameIds.length) + gameIds.length) % gameIds.length] ??
    ("desenhar" satisfies GameId);
  const focused = choosing ?? at(0);

  useEffect(() => {
    const container = root.current;
    if (!layer.current || !container) return;
    const element: HTMLDivElement = layer.current;
    const controls = mountMovementControls(container);
    let request = 0;
    let epoch: number | undefined;
    let anchor: BodyAnchor | null = null;
    let seenAt = -Infinity;
    let previousAt = performance.now();
    function tick() {
      const now = performance.now();
      const elapsed = now - previousAt;
      previousAt = now;
      const frame = frames.latest();
      const fresh = frame !== null && isFresh(frame, now);
      const points: ControlPoint[] = [];
      if (frame && fresh) {
        if (frame.epoch !== epoch) {
          controls.reset();
          anchor = null;
        }
        epoch = frame.epoch;
        const cover = cameraCover(frame.width, frame.height, innerWidth, innerHeight);
        const found = findAnchor(frame, cover);
        if (found) {
          seenAt = now;
          // Follow the player closely, but let the size shrink slowly: turning sideways narrows
          // the shoulders without bringing the objects any closer.
          const follow = 1 - Math.exp(-elapsed / 120);
          const shrink = 1 - Math.exp(-elapsed / 1500);
          const next = found.anchor;
          anchor = anchor
            ? {
                x: anchor.x + (next.x - anchor.x) * follow,
                y: anchor.y + (next.y - anchor.y) * follow,
                unit:
                  anchor.unit +
                  (next.unit - anchor.unit) * (next.unit > anchor.unit ? follow : shrink),
              }
            : next;
          for (const left of [false, true]) {
            const hand = estimateIndexPoint(found.body, left, frame.width / frame.height);
            if (hand)
              points.push({
                key: left ? "left" : "right",
                x: cover.left + (1 - hand.x) * cover.width,
                y: cover.top + hand.y * cover.height,
              });
          }
        }
      }
      if (anchor && now - seenAt > ANCHOR_HOLD_MS) anchor = null;
      element.dataset.presence = anchor ? "tracking" : fresh ? "empty" : "waiting";
      if (anchor) {
        const layout = menuLayout(anchor, innerWidth);
        const set = (name: string, value: number) =>
          element.style.setProperty(name, `${value.toFixed(1)}px`);
        set("--card-x", layout.card.x);
        set("--card-y", layout.card.y);
        set("--card", layout.card.size);
        set("--previous-x", layout.previous.x);
        set("--next-x", layout.next.x);
        set("--bubble-y", layout.previous.y);
        set("--bubble", layout.previous.size);
      }
      controls.update(points, now);
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      controls.dispose();
    };
  }, [frames, root]);

  function turn(step: number) {
    sounds.play("turn");
    setFocus((current) => current + step);
  }
  function pick() {
    const [only, ...more] = games[focused].players;
    sounds.play("select");
    if (only !== undefined && more.length === 0) onOpen(focused, only);
    else setChoosing(focused);
  }
  function open(players: PoseLimit) {
    sounds.play("select");
    onOpen(focused, players);
  }

  return (
    <div class="body-menu" ref={layer} data-presence="waiting">
      <p class="body-menu__hint" role="status">
        <Icon>{onePerson}</Icon>
        Fique de frente para a câmera
      </p>
      <div class="body-menu__objects">
        {choosing ? (
          <>
            <button
              class="shelf-card"
              type="button"
              style={{ "--tile": games[focused].color }}
              aria-label="Voltar aos jogos"
              onClick={() => {
                sounds.play("back");
                setChoosing(null);
              }}
            >
              <Icon>{games[focused].icon}</Icon>
              <strong>← Voltar</strong>
            </button>
            <button
              class="side-bubble side-bubble--previous"
              type="button"
              disabled={busy}
              aria-label="1 pessoa"
              onClick={() => open(1)}
            >
              <Icon>{onePerson}</Icon>
            </button>
            <button
              class="side-bubble side-bubble--next"
              type="button"
              disabled={busy}
              aria-label="2 pessoas"
              onClick={() => open(2)}
            >
              <Icon>{twoPeople}</Icon>
            </button>
          </>
        ) : (
          <>
            {gameIds.length > 1 ? (
              <>
                <span
                  class="shelf-peek shelf-peek--previous"
                  style={{ "--tile": games[at(-1)].color }}
                >
                  <Icon>{games[at(-1)].icon}</Icon>
                </span>
                <span class="shelf-peek shelf-peek--next" style={{ "--tile": games[at(1)].color }}>
                  <Icon>{games[at(1)].icon}</Icon>
                </span>
              </>
            ) : null}
            <button
              class="shelf-card"
              type="button"
              disabled={busy}
              style={{ "--tile": games[focused].color }}
              aria-label={`Jogar ${games[focused].name}`}
              onClick={pick}
            >
              <Icon>{games[focused].icon}</Icon>
              <strong>{games[focused].label}</strong>
            </button>
            <button
              class="side-bubble side-bubble--previous"
              type="button"
              aria-label="Jogo anterior"
              data-dwell-repeat-ms={TURN_REPEAT_MS}
              onClick={() => turn(-1)}
            >
              <Icon box="0 0 24 24">
                <path d="M15 4 L7 12 L15 20" stroke-width="3.5" />
              </Icon>
            </button>
            <button
              class="side-bubble side-bubble--next"
              type="button"
              aria-label="Próximo jogo"
              data-dwell-repeat-ms={TURN_REPEAT_MS}
              onClick={() => turn(1)}
            >
              <Icon box="0 0 24 24">
                <path d="M9 4 L17 12 L9 20" stroke-width="3.5" />
              </Icon>
            </button>
          </>
        )}
      </div>
      <button
        class="menu-exit"
        type="button"
        aria-label="Encerrar brincadeira"
        data-dwell-ms={EXIT_HOLD_MS}
        onClick={onStop}
      >
        Sair
      </button>
      <Diagnostic frames={frames} />
    </div>
  );
}
