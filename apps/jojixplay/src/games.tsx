import type { Experience, Frame, GameHost } from "@jojixplay/game-sdk";
import type { ComponentChildren } from "preact";
import type { PoseLimit } from "./domain/pose-limit";

export type GameId = "desenhar" | "corrida" | "sensores";

/** A game reads the part of a frame it needs; the host hands every game the whole frame. */
type MountGame = (container: HTMLElement, host: GameHost, players: PoseLimit) => Experience<Frame>;

interface GameEntry {
  readonly name: string;
  /** One word for the menu card. */
  readonly label: string;
  readonly stageLabel: string;
  readonly loadingCopy: string;
  /** How many people can play. More than one choice adds a step after the game is picked. */
  readonly players: readonly PoseLimit[];
  readonly color: string;
  /** Drawn inside a 100 by 100 stroked viewBox. */
  readonly icon: ComponentChildren;
  /** Each game is its own lazy chunk; nothing of a game loads before it is chosen. */
  load(): Promise<MountGame>;
}

/** The menu shelf shows games in this order. Adding a game is one entry here. */
export const games: Readonly<Record<GameId, GameEntry>> = {
  desenhar: {
    name: "Desenhar",
    label: "Desenhar",
    stageLabel: "Ateliê Desenhar",
    loadingCopy: "Preparando suas cores…",
    players: [1, 2],
    color: "#ffd23f",
    icon: (
      <>
        <path d="M18 82 L26 58 L66 18 L82 34 L42 74 Z" fill="#ff5a4e" />
        <path d="M58 26 L74 42" />
        <path d="M18 82 L42 74 L26 58 Z" fill="#fff" />
      </>
    ),
    load: () => import("@jojixplay/desenhar").then(({ mountDesenhar }) => mountDesenhar),
  },
  corrida: {
    name: "Corrida dos Blocos",
    label: "Corrida",
    stageLabel: "Pista Corrida dos Blocos",
    loadingCopy: "Preparando a pista…",
    players: [1],
    color: "#36c5f0",
    icon: (
      <>
        <circle cx="60" cy="18" r="10" fill="#fff" />
        <path d="M56 32 L44 54 L60 66 L54 88" />
        <path d="M44 54 L26 62 L18 80" />
        <path d="M52 38 L70 46 L84 38" />
        <path d="M50 40 L34 34" />
      </>
    ),
    load: () => import("@jojixplay/corrida").then(({ mountCorrida }) => mountCorrida),
  },
  // Not a game for children: the owner's bench for trying each kind of sensing.
  sensores: {
    name: "Sensores",
    label: "Sensores",
    stageLabel: "Bancada de sensores",
    loadingCopy: "Preparando os sensores…",
    players: [1],
    color: "#c9a6ff",
    icon: (
      <>
        <circle cx="50" cy="50" r="10" fill="#fff" />
        <path d="M30 30 A28 28 0 0 0 30 70" />
        <path d="M70 30 A28 28 0 0 1 70 70" />
        <path d="M16 18 A46 46 0 0 0 16 82" />
        <path d="M84 18 A46 46 0 0 1 84 82" />
      </>
    ),
    load: () => import("@jojixplay/sensores").then(({ mountSensores }) => mountSensores),
  },
};

export const gameIds = Object.keys(games) as GameId[];

/**
 * What the menu's row of cards shows, in order. A null is an empty place for a game that does not
 * exist yet: it is drawn greyed out and cannot be chosen.
 */
export const shelf: ReadonlyArray<GameId | null> = [...gameIds, null, null];
