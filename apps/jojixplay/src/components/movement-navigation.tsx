import {
  isFresh,
  mountMovementControls,
  type BodyFrame,
  type ControlPoint,
} from "@jojixplay/game-sdk";
import { useEffect, useRef } from "preact/hooks";

/** Host navigation stays active while game input is paused by host dialogs. */
export function MovementNavigation({
  frame,
  active,
  drawing,
}: {
  frame: BodyFrame | null;
  active: boolean;
  drawing: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const latest = useRef(frame);
  latest.current = frame;
  useEffect(() => {
    const root = anchor.current?.closest("main");
    if (!root || !active) return;
    const controls = mountMovementControls(
      root,
      (button) => !button.closest(".draw-game"),
      !drawing,
    );
    let request = 0;
    let epoch: number | undefined;
    function tick() {
      const frame = latest.current;
      const points: ControlPoint[] = [];
      if (frame && isFresh(frame, performance.now())) {
        if (frame.epoch !== epoch) controls.reset();
        epoch = frame.epoch;
        const paper = drawing ? root?.querySelector(".draw-paper")?.getBoundingClientRect() : null;
        const width = paper
          ? Math.min(paper.width, (paper.height * frame.width) / frame.height)
          : innerWidth;
        const height = paper ? (width * frame.height) / frame.width : innerHeight;
        const left = paper ? paper.left + (paper.width - width) / 2 : 0;
        const top = paper ? paper.top + (paper.height - height) / 2 : 0;
        const back = root?.querySelector<HTMLElement>(".game-back");
        if (back && paper) back.style.right = `${Math.max(14, (paper.width - width) / 2 + 14)}px`;
        for (const body of frame.bodies) {
          const center =
            body.leftShoulder && body.rightShoulder
              ? (body.leftShoulder.x + body.rightShoulder.x) / 2
              : null;
          const zone =
            frame.bodies.length === 1
              ? "solo"
              : center === null
                ? null
                : center < 0.44
                  ? "right"
                  : center > 0.56
                    ? "left"
                    : null;
          if (!zone) continue;
          for (const hand of ["leftWrist", "rightWrist"] as const) {
            const wrist = body[hand];
            if (wrist)
              points.push({
                key: `${zone}-${hand}`,
                x: left + (1 - wrist.x) * width,
                y: top + wrist.y * height,
              });
          }
        }
      }
      // Ambiguous same-zone detections must never combine their dwell time.
      controls.update(
        points.filter((point) => points.filter((other) => other.key === point.key).length === 1),
        performance.now(),
      );
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      controls.dispose();
    };
  }, [active, drawing]);
  return <span ref={anchor} aria-hidden="true" />;
}
