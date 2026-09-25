import {
  isFresh,
  mountMovementControls,
  type BodyFrame,
  type ControlPoint,
} from "@jojixplay/game-sdk";
import { useEffect, useRef } from "preact/hooks";
import { cameraCover, estimateIndexPoint } from "../domain/camera-view";

/** The same projected point drives the circle and button hit testing. */
export function MovementNavigation({
  frame,
  active,
  drawing,
}: {
  frame: BodyFrame | null;
  active: boolean;
  drawing: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const latest = useRef(frame);
  latest.current = frame;
  useEffect(() => {
    const container = layer.current;
    const root = container?.closest("main");
    if (!root || !container || !active) return;
    const controls = mountMovementControls(
      root,
      (button) => !button.closest(".draw-game"),
      drawing ? "target" : "always",
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
        const cover = cameraCover(frame.width, frame.height, innerWidth, innerHeight);
        const width = paper
          ? Math.min(paper.width, (paper.height * frame.width) / frame.height)
          : cover.width;
        const height = paper ? (width * frame.height) / frame.width : cover.height;
        const left = paper ? paper.left + (paper.width - width) / 2 : drawing ? 0 : cover.left;
        const top = paper ? paper.top + (paper.height - height) / 2 : drawing ? 0 : cover.top;
        const back = root?.querySelector<HTMLElement>(".game-back");
        if (back && paper) back.style.right = `${Math.max(14, (paper.width - width) / 2 + 14)}px`;
        for (const isLeft of [false, true]) {
          // Spatial hand slots only: no body/torso prerequisite or detector-array identity.
          const wrists = frame.bodies
            .map((body) =>
              drawing
                ? body[isLeft ? "leftWrist" : "rightWrist"]
                : estimateIndexPoint(body, isLeft, frame.width / frame.height),
            )
            .filter((point) => point !== undefined)
            .sort((a, b) => a.x - b.x);
          wrists.forEach((wrist, i) => {
            points.push({
              key: `${isLeft}-${i}`,
              x: left + (1 - wrist.x) * width,
              y: top + wrist.y * height,
            });
          });
        }
      }
      controls.update(points, performance.now());
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      controls.dispose();
    };
  }, [active, drawing]);
  return <div ref={layer} aria-hidden="true" />;
}
