import type { Experience, GameHost } from "@jojixplay/game-sdk";
import type { PoseLimit } from "./domain/pose-limit";

export type GameId = "desenhar" | "corrida";

type MountGame = (container: HTMLElement, host: GameHost, players: PoseLimit) => Experience;

interface GameEntry {
  readonly name: string;
  readonly stageLabel: string;
  readonly loadingCopy: string;
  /** Each game is its own lazy chunk; nothing of a game loads before it is chosen. */
  load(): Promise<MountGame>;
}

export const games: Readonly<Record<GameId, GameEntry>> = {
  desenhar: {
    name: "Desenhar",
    stageLabel: "Ateliê Desenhar",
    loadingCopy: "Preparando suas cores…",
    load: () => import("@jojixplay/desenhar").then(({ mountDesenhar }) => mountDesenhar),
  },
  corrida: {
    name: "Corrida dos Blocos",
    stageLabel: "Pista Corrida dos Blocos",
    loadingCopy: "Preparando a pista…",
    load: () => import("@jojixplay/corrida").then(({ mountCorrida }) => mountCorrida),
  },
};
