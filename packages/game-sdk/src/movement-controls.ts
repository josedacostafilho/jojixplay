export interface ControlPoint {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly player?: number;
}

/** One dwell implementation for menus, game tools and modal confirmations. */
export function mountMovementControls(
  root: HTMLElement,
  accepts: (button: HTMLButtonElement) => boolean = () => true,
  pointer: "always" | "target" | "none" = "always",
) {
  const states = new Map<
    string,
    {
      point: ControlPoint;
      cursor: HTMLDivElement;
      button: HTMLButtonElement | null;
      since: number;
      armed: boolean;
    }
  >();
  let previousTargets: HTMLButtonElement[] = [];
  function reset() {
    for (const state of states.values()) {
      state.button?.style.removeProperty("--dwell");
      state.cursor.remove();
    }
    states.clear();
  }
  // Touch and keyboard selections must also release every movement dwell.
  root.addEventListener("click", reset, true);
  return {
    update(points: readonly ControlPoint[], now: number) {
      const modal = document.querySelector<HTMLDialogElement>("dialog[open]");
      const scope = modal ?? root;
      const targets = [...scope.querySelectorAll<HTMLButtonElement>("button")].filter(
        (button) =>
          root.contains(button) &&
          accepts(button) &&
          !button.disabled &&
          button.getClientRects().length > 0,
      );
      if (
        targets.length !== previousTargets.length ||
        targets.some((b, i) => b !== previousTargets[i])
      )
        reset();
      previousTargets = targets;
      const keys = new Set(points.map((point) => point.key));
      for (const [key, state] of states) {
        if (!keys.has(key)) {
          state.button?.style.removeProperty("--dwell");
          state.cursor.remove();
          states.delete(key);
        }
      }
      for (const point of points) {
        let state = states.get(point.key);
        if (!state) {
          const cursor = document.createElement("div");
          cursor.setAttribute("aria-hidden", "true");
          cursor.className = "movement-pointer";
          cursor.style.cssText =
            "position:fixed;width:38px;height:38px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #294b4b;pointer-events:none;z-index:10000;transform:translate(-50%,-50%);display:grid;place-items:center;color:#294b4b;font-size:21px;background:#f7c853";
          cursor.textContent = "✋";
          state = { point, cursor, button: null, since: now, armed: false };
          states.set(point.key, state);
        }
        const jump =
          Math.hypot(point.x - state.point.x, point.y - state.point.y) >
          0.25 * Math.min(innerWidth, innerHeight);
        state.point = point;
        const hit = document.elementFromPoint(point.x, point.y);
        const button =
          targets.find((button) => {
            const owner = button.closest<HTMLElement>("[data-player]")?.dataset.player;
            if (owner !== undefined && Number(owner) !== point.player) return false;
            const r = button.getBoundingClientRect();
            return (
              point.x >= r.left &&
              point.x <= r.right &&
              point.y >= r.top &&
              point.y <= r.bottom &&
              !!hit &&
              button.contains(hit)
            );
          }) ?? null;
        if (button !== state.button || jump) {
          state.button?.style.removeProperty("--dwell");
          state.button = button;
          state.since = now;
        }
        if (!button) state.armed = true;
        const progress = button && state.armed ? Math.min(1, (now - state.since) / 800) : 0;
        if (button) button.style.setProperty("--dwell", `${progress * 100}%`);
        // A modal's top layer requires its cursor to live inside that modal.
        if (state.cursor.parentElement !== scope) scope.append(state.cursor);
        state.cursor.hidden =
          pointer === "none" || !targets.length || (pointer === "target" && !button && !modal);
        state.cursor.style.display = state.cursor.hidden ? "none" : "grid";
        state.cursor.style.left = `${point.x}px`;
        state.cursor.style.top = `${point.y}px`;
        state.cursor.style.background = `conic-gradient(#72c49d ${progress * 100}%, #f7c853 0)`;
        if (button && progress === 1) {
          reset();
          button.click();
          return;
        }
      }
    },
    reset,
    dispose() {
      reset();
      root.removeEventListener("click", reset, true);
    },
  };
}
