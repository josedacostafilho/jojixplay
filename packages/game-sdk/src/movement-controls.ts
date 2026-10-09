import "./movement-controls.css";

/** How long a hand must rest on a button before it activates, unless `data-dwell-ms` says otherwise. */
const DWELL_MS = 800;
/** A hand that moves farther than this share of the short viewport side between updates restarts its dwell. */
const JUMP_LIMIT = 0.25;

/** A hand position in viewport pixels. `player` restricts it to controls inside a matching `data-player`. */
export interface ControlPoint {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly player?: number;
}

export interface MovementControls {
  update(points: readonly ControlPoint[], now: number): void;
  /** Forget every dwell in progress. A hand must leave its button before it can dwell again. */
  reset(): void;
  dispose(): void;
}

interface Hand {
  point: ControlPoint;
  readonly cursor: HTMLDivElement;
  button: HTMLButtonElement | null;
  since: number;
  /** Set once the hand has been seen away from every button, so a stale pose cannot activate one. */
  armed: boolean;
  /** Set while a hand keeps holding a `data-dwell-repeat-ms` button after its first activation. */
  repeating: boolean;
}

/**
 * The one dwell implementation for menus, game tools and confirmations. Every enabled, visible
 * button under `root` is a target; an open modal dialog under `root` narrows targets to itself.
 * `pointer: "target"` shows the cursor only over a target, for games that draw their own pointer.
 * A button may set `data-dwell-ms` for its own hold time, and `data-dwell-repeat-ms` to keep
 * activating at that interval while the hand stays on it.
 */
export function mountMovementControls(
  root: HTMLElement,
  options: { readonly pointer?: "always" | "target" } = {},
): MovementControls {
  const hands = new Map<string, Hand>();
  let previousTargets: readonly HTMLButtonElement[] = [];

  function release(hand: Hand) {
    hand.button?.style.removeProperty("--dwell");
    hand.cursor.remove();
  }
  function reset() {
    for (const hand of hands.values()) release(hand);
    hands.clear();
  }
  let activating = false;
  // Touch and keyboard selections must also release every movement dwell.
  const onClick = () => {
    if (!activating) reset();
  };
  root.addEventListener("click", onClick, true);

  function update(points: readonly ControlPoint[], now: number) {
    if (points.length === 0) {
      reset();
      return;
    }
    const modal = root.querySelector<HTMLDialogElement>("dialog[open]");
    const scope = modal ?? root;
    const targets: HTMLButtonElement[] = [];
    const rects: DOMRect[] = [];
    for (const button of scope.querySelectorAll("button")) {
      if (button.disabled) continue;
      const rect = button.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      targets.push(button);
      rects.push(rect);
    }
    if (
      targets.length !== previousTargets.length ||
      targets.some((button, i) => button !== previousTargets[i])
    )
      reset();
    previousTargets = targets;

    for (const [key, hand] of hands) {
      if (points.some((point) => point.key === key)) continue;
      release(hand);
      hands.delete(key);
    }

    for (const point of points) {
      let hand = hands.get(point.key);
      if (!hand) {
        const cursor = document.createElement("div");
        cursor.className = "movement-pointer";
        cursor.setAttribute("aria-hidden", "true");
        hand = { point, cursor, button: null, since: now, armed: false, repeating: false };
        hands.set(point.key, hand);
      }
      const jumped =
        Math.hypot(point.x - hand.point.x, point.y - hand.point.y) >
        JUMP_LIMIT * Math.min(innerWidth, innerHeight);
      hand.point = point;

      // A rectangle hit is not enough: a panel or another button may be drawn over this one.
      let top: Element | null | undefined;
      const index = rects.findIndex((rect, i) => {
        if (
          point.x < rect.left ||
          point.x > rect.right ||
          point.y < rect.top ||
          point.y > rect.bottom
        )
          return false;
        const owner = targets[i]?.closest<HTMLElement>("[data-player]")?.dataset.player;
        if (owner !== undefined && Number(owner) !== point.player) return false;
        if (top === undefined) top = document.elementFromPoint(point.x, point.y);
        return top !== null && !!targets[i]?.contains(top);
      });
      const button = targets[index] ?? null;

      if (button !== hand.button || jumped) {
        hand.button?.style.removeProperty("--dwell");
        hand.button = button;
        hand.since = now;
        hand.repeating = false;
      }
      if (!button) hand.armed = true;
      const repeatMs = Number(button?.dataset.dwellRepeatMs) || 0;
      const holdMs = hand.repeating ? repeatMs : Number(button?.dataset.dwellMs) || DWELL_MS;
      const progress = button && hand.armed ? Math.min(1, (now - hand.since) / holdMs) : 0;
      const percent = `${progress * 100}%`;
      button?.style.setProperty("--dwell", percent);

      const { cursor } = hand;
      // A modal's top layer requires its cursor to live inside that modal.
      if (cursor.parentElement !== scope) scope.append(cursor);
      cursor.hidden = targets.length === 0 || (options.pointer === "target" && !button && !modal);
      cursor.style.left = `${point.x}px`;
      cursor.style.top = `${point.y}px`;
      cursor.style.setProperty("--dwell", percent);

      if (button && progress === 1) {
        if (repeatMs > 0) {
          hand.since = now;
          hand.repeating = true;
          activating = true;
          button.click();
          activating = false;
          continue;
        }
        reset();
        button.click();
        return;
      }
    }
  }

  return {
    update,
    reset,
    dispose() {
      reset();
      root.removeEventListener("click", onClick, true);
    },
  };
}
