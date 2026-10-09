import { type ControlPoint, isFresh, mountMovementControls } from "@jojixplay/game-sdk";
import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";
import { cameraCover, estimateIndexPoint } from "../domain/camera-view";
import type { BodyFrameSource } from "../pose/body-frame-source";

/**
 * Drives menu buttons from hands seen over the fullscreen camera. Each circle sits where its hand
 * appears in the mirrored video, and that same point is the one hit-tested against buttons.
 */
export function MenuPointers({
  frames,
  root,
}: {
  frames: BodyFrameSource;
  root: RefObject<HTMLElement>;
}) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const controls = mountMovementControls(element);
    let request = 0;
    let epoch: number | undefined;
    function tick() {
      const now = performance.now();
      const frame = frames.latest();
      const points: ControlPoint[] = [];
      if (frame && isFresh(frame, now)) {
        if (frame.epoch !== epoch) controls.reset();
        epoch = frame.epoch;
        const cover = cameraCover(frame.width, frame.height, innerWidth, innerHeight);
        for (const left of [false, true]) {
          // Hands are keyed by side and screen order: no torso prerequisite, no detector identity.
          frame.bodies
            .map((body) => estimateIndexPoint(body, left, frame.width / frame.height))
            .filter((point) => point !== undefined)
            .sort((a, b) => a.x - b.x)
            .forEach((point, i) => {
              points.push({
                key: `${left ? "left" : "right"}-${i}`,
                x: cover.left + (1 - point.x) * cover.width,
                y: cover.top + point.y * cover.height,
              });
            });
        }
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
  return null;
}
