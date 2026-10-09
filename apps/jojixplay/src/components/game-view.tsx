import type { CameraImage, Experience, Frame, Sensing } from "@jojixplay/game-sdk";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PoseLimit } from "../domain/pose-limit";
import { type GameId, games } from "../games";
import type { FrameSource } from "../pose/frame-source";

/** Loads and mounts one game, then feeds it sensed frames directly from the camera. */
export function GameView({
  game,
  players,
  frames,
  onExit,
  onFailed,
  onSense,
  onShowCamera,
  camera,
}: {
  game: GameId;
  players: PoseLimit;
  frames: FrameSource;
  onExit: () => void;
  onFailed: () => void;
  onSense: (sensing: Sensing) => Promise<void>;
  onShowCamera: (visible: boolean) => void;
  camera: () => CameraImage | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const callbacks = useRef({ onExit, onFailed, onSense, onShowCamera, camera });
  callbacks.current = { onExit, onFailed, onSense, onShowCamera, camera };

  useEffect(() => {
    let experience: Experience<Frame> | null = null;
    let unsubscribe = () => {};
    let cancelled = false;
    setLoading(true);
    void games[game]
      .load()
      .then((mount) => {
        if (cancelled || !container.current) return;
        const mounted = mount(
          container.current,
          {
            exit: () => callbacks.current.onExit(),
            sense: (sensing) =>
              cancelled
                ? Promise.reject(new Error("The game is no longer running."))
                : callbacks.current.onSense(sensing),
            showCamera: (visible) => {
              if (!cancelled) callbacks.current.onShowCamera(visible);
            },
            camera: () => (cancelled ? null : callbacks.current.camera()),
          },
          players,
        );
        experience = mounted;
        mounted.update(frames.latest());
        unsubscribe = frames.subscribe((frame) => mounted.update(frame));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onFailed();
      });
    return () => {
      cancelled = true;
      unsubscribe();
      experience?.dispose();
    };
  }, [game, players, frames]);

  return (
    <>
      <div class="game-mount" ref={container} />
      {loading ? (
        <p class="game-loading" role="status">
          {games[game].loadingCopy}
        </p>
      ) : null}
    </>
  );
}
