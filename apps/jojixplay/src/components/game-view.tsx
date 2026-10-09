import type { Experience } from "@jojixplay/game-sdk";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PoseLimit } from "../domain/pose-limit";
import { type GameId, games } from "../games";
import type { BodyFrameSource } from "../pose/body-frame-source";

/** Loads and mounts one game, then feeds it pose frames directly from the camera. */
export function GameView({
  game,
  players,
  frames,
  onExit,
  onFailed,
}: {
  game: GameId;
  players: PoseLimit;
  frames: BodyFrameSource;
  onExit: () => void;
  onFailed: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const callbacks = useRef({ onExit, onFailed });
  callbacks.current = { onExit, onFailed };

  useEffect(() => {
    let experience: Experience | null = null;
    let unsubscribe = () => {};
    let cancelled = false;
    setLoading(true);
    void games[game]
      .load()
      .then((mount) => {
        if (cancelled || !container.current) return;
        const mounted = mount(
          container.current,
          { exit: () => callbacks.current.onExit() },
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
