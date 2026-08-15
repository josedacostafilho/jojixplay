import { useEffect, useRef } from "preact/hooks";
import type { RacingSnapshot, RacingSession } from "./racing-session";

interface RacingCanvasProps {
  session: RacingSession;
  playerCount: 1 | 2;
  onReady: () => void;
  onSnapshot: (snapshot: RacingSnapshot) => void;
  onError: (message: string) => void;
}

export function RacingCanvas({
  session,
  playerCount,
  onReady,
  onSnapshot,
  onError,
}: RacingCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onSnapshotRef = useRef(onSnapshot);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onSnapshotRef.current = onSnapshot;
  onErrorRef.current = onError;

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }
    let disposed = false;
    let runtime: { destroy: () => void } | null = null;
    void import("./racing-runtime")
      .then(({ RacingRuntime }) => {
        if (disposed) {
          return;
        }
        runtime = new RacingRuntime({
          parent: host,
          session,
          playerCount,
          onReady: () => {
            if (!disposed) {
              onReadyRef.current();
            }
          },
          onSnapshot: (snapshot) => {
            if (!disposed) {
              onSnapshotRef.current(snapshot);
            }
          },
          onError: (message) => {
            if (!disposed) {
              onErrorRef.current(message);
            }
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          onErrorRef.current("Racing could not start on this television browser.");
        }
      });
    return () => {
      disposed = true;
      runtime?.destroy();
    };
  }, [playerCount, session]);

  return (
    <div
      ref={hostRef}
      class="racing-canvas"
      role="img"
      aria-label={
        playerCount === 1
          ? "Pseudo-3D Racing course and car"
          : "Split-screen pseudo-3D Racing course and cars"
      }
    />
  );
}
