import {
  isFresh,
  mountMovementControls,
  type BodyFrame,
  type ControlPoint,
} from "@jojixplay/game-sdk";
import { mountHandView, type HandPoint } from "@jojixplay/movement-view";
import { useEffect, useRef } from "preact/hooks";
import { cameraCover, handCenter } from "../domain/camera-view";

/** The same projected point drives the hand mesh and button hit testing. */
export function MovementNavigation({
  frame,
  active,
  drawing,
  onError,
}: {
  frame: BodyFrame | null;
  active: boolean;
  drawing: boolean;
  onError: (message: string) => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const latest = useRef({ frame, onError });
  latest.current = { frame, onError };
  useEffect(() => {
    const container = layer.current;
    const root = container?.closest("main");
    if (!root || !container || !active) return;
    const controls = mountMovementControls(
      root,
      (button) => !button.closest(".draw-game"),
      drawing ? "target" : "none",
    );
    let hands: Awaited<ReturnType<typeof mountHandView>> | null = null;
    let disposed = false;
    if (!drawing)
      void mountHandView(container)
        .then((view) => {
          if (disposed) view.dispose();
          else hands = view;
        })
        .catch(() => {
          if (!disposed)
            latest.current.onError(
              "Não foi possível carregar as mãos em 3D. Recarregue a página para tentar novamente.",
            );
        });
    let request = 0;
    let epoch: number | undefined;
    function tick() {
      const frame = latest.current.frame;
      const points: (ControlPoint & HandPoint)[] = [];
      if ((drawing || hands) && frame && isFresh(frame, performance.now())) {
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
              drawing ? body[isLeft ? "leftWrist" : "rightWrist"] : handCenter(body, isLeft),
            )
            .filter((point) => point !== undefined)
            .sort((a, b) => a.x - b.x);
          wrists.forEach((wrist, i) => {
            points.push({
              key: `${isLeft}-${i}`,
              left: isLeft,
              x: left + (1 - wrist.x) * width,
              y: top + wrist.y * height,
            });
          });
        }
      }
      hands?.update(points);
      controls.update(points, performance.now());
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(request);
      controls.dispose();
      hands?.dispose();
    };
  }, [active, drawing]);
  return <div ref={layer} class="hand-layer" aria-hidden="true" />;
}
