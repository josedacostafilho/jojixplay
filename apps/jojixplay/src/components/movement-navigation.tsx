import {
  isFresh,
  mountMovementControls,
  reachableHand,
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
  playing,
}: {
  frame: BodyFrame | null;
  active: boolean;
  drawing: boolean;
  playing: boolean;
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
      (button) => !button.closest(".draw-game, .race-game, .swing-game"),
      playing ? "target" : "always",
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
        const race =
          !drawing && playing
            ? root?.querySelector(".race-game, .swing-game")?.getBoundingClientRect()
            : null;
        const width = race
          ? race.width
          : paper
            ? Math.min(paper.width, (paper.height * frame.width) / frame.height)
            : cover.width;
        const height = race
          ? race.height
          : paper
            ? (width * frame.height) / frame.width
            : cover.height;
        const left = race
          ? race.left
          : paper
            ? paper.left + (paper.width - width) / 2
            : drawing
              ? 0
              : cover.left;
        const top = race
          ? race.top
          : paper
            ? paper.top + (paper.height - height) / 2
            : drawing
              ? 0
              : cover.top;
        const back = root?.querySelector<HTMLElement>(".game-back");
        if (back && paper) back.style.right = `${Math.max(14, (paper.width - width) / 2 + 14)}px`;
        for (const isLeft of [false, true]) {
          // Spatial hand slots only: no body/torso prerequisite or detector-array identity.
          const wrists = frame.bodies
            .map((body) =>
              playing
                ? body[isLeft ? "leftWrist" : "rightWrist"]
                : estimateIndexPoint(body, isLeft, frame.width / frame.height),
            )
            .filter((point) => point !== undefined)
            .sort((a, b) => a.x - b.x);
          wrists.forEach((wrist, i) => {
            const point = race ? reachableHand(wrist.x, wrist.y) : { x: 1 - wrist.x, y: wrist.y };
            points.push({
              key: `${isLeft}-${i}`,
              x: left + point.x * width,
              y: top + point.y * height,
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
  }, [active, drawing, playing]);
  return <div ref={layer} aria-hidden="true" />;
}
