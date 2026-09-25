import type { BodyFrame, Experience } from "@jojixplay/game-sdk";
import { useEffect, useRef, useState } from "preact/hooks";

export function GameView({
  frame,
  players,
  game,
}: {
  frame: BodyFrame | null;
  players: 1 | 2;
  game: "desenhar" | "corrida" | "swinging";
}) {
  const host = useRef<HTMLDivElement>(null),
    experience = useRef<Experience | null>(null),
    latest = useRef(frame);
  const [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  latest.current = frame;
  useEffect(() => {
    let cancelled = false;
    const load =
      game === "desenhar"
        ? import("@jojixplay/desenhar").then(
            ({ mountDesenhar }) =>
              (host: HTMLElement) =>
                mountDesenhar(host, players),
          )
        : game === "corrida"
          ? import("@jojixplay/corrida").then(({ mountCorrida }) => mountCorrida)
          : import("@jojixplay/swinging").then(({ mountSwinging }) => mountSwinging);
    setLoading(true);
    setError(false);
    void load
      .then((mount) => {
        if (cancelled || !host.current) return;
        experience.current = mount(host.current);
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
  }, [players, game]);
  useEffect(() => {
    experience.current?.update(frame);
  }, [frame]);
  return (
    <div class="game-mount" ref={host}>
      {loading ? (
        <p class="game-loading" role="status">
          {game === "desenhar"
            ? "Preparando suas cores…"
            : game === "corrida"
              ? "Preparando a pista…"
              : "Preparando a cidade…"}
        </p>
      ) : null}
      {error ? (
        <p class="inline-error" role="alert">
          Não foi possível abrir{" "}
          {game === "desenhar"
            ? "Desenhar"
            : game === "corrida"
              ? "Corrida dos Blocos"
              : "o protótipo de teias"}
          . Volte e tente novamente.
        </p>
      ) : null}
    </div>
  );
}
