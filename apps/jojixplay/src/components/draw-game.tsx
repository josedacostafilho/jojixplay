import type { BodyFrame, Experience } from "@jojixplay/game-sdk";
import { useEffect, useRef, useState } from "preact/hooks";

export function DrawGame({ frame, players }: { frame: BodyFrame | null; players: 1 | 2 }) {
  const host = useRef<HTMLDivElement>(null),
    experience = useRef<Experience | null>(null),
    latest = useRef(frame);
  const [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  latest.current = frame;
  useEffect(() => {
    let cancelled = false;
    void import("@jojixplay/desenhar")
      .then(({ mountDesenhar }) => {
        if (cancelled || !host.current) return;
        experience.current = mountDesenhar(host.current, players);
        experience.current.update(latest.current);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      experience.current?.dispose();
      experience.current = null;
    };
  }, [players]);
  useEffect(() => {
    experience.current?.update(frame);
  }, [frame]);
  return (
    <div class="game-mount" ref={host}>
      {loading ? (
        <p class="game-loading" role="status">
          Preparando suas cores…
        </p>
      ) : null}
      {error ? (
        <p class="inline-error" role="alert">
          Não foi possível abrir Desenhar. Volte e tente novamente.
        </p>
      ) : null}
    </div>
  );
}
