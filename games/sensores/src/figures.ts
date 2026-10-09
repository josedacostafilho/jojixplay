import type {
  Body,
  ControlPoint,
  Frame,
  Hand,
  HandPointName,
  JointName,
  Silhouette,
} from "@jojixplay/game-sdk";

/** Viewport pixels showing the whole camera image, as `cameraCover` returns. */
export interface Cover {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The person's own side, so a swapped left and right is visible at a glance. */
export type Side = "left" | "right" | "center";

/** Everything sensed in one frame, as line segments and dots in viewport pixels. */
export interface Figures {
  readonly segments: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number; side: Side }>;
  readonly dots: ReadonlyArray<{ x: number; y: number; side: Side }>;
  readonly labels: ReadonlyArray<{ x: number; y: number; side: Side; text: string }>;
}

const limb = (side: "left" | "right"): ReadonlyArray<readonly [JointName, JointName]> => [
  [`${side}Shoulder`, `${side}Hip`],
  [`${side}Shoulder`, `${side}Elbow`],
  [`${side}Elbow`, `${side}Wrist`],
  [`${side}Wrist`, `${side}Thumb`],
  [`${side}Wrist`, `${side}Index`],
  [`${side}Wrist`, `${side}Pinky`],
  [`${side}Index`, `${side}Pinky`],
  [`${side}Hip`, `${side}Knee`],
  [`${side}Knee`, `${side}Ankle`],
  [`${side}Ankle`, `${side}Heel`],
  [`${side}Heel`, `${side}Foot`],
  [`${side}Ankle`, `${side}Foot`],
  ["nose", `${side}Eye`],
  [`${side}Eye`, `${side}Ear`],
];
const bodyBones: ReadonlyArray<readonly [JointName, JointName, Side]> = [
  ["leftShoulder", "rightShoulder", "center"],
  ["leftHip", "rightHip", "center"],
  ...(["left", "right"] as const).flatMap((side) =>
    limb(side).map(([from, to]) => [from, to, side] as const),
  ),
];

const finger = (
  name: "index" | "middle" | "ring" | "pinky",
): ReadonlyArray<readonly [HandPointName, HandPointName]> => [
  [`${name}Knuckle`, `${name}Middle`],
  [`${name}Middle`, `${name}Joint`],
  [`${name}Joint`, `${name}Tip`],
];
const handBones: ReadonlyArray<readonly [HandPointName, HandPointName]> = [
  ["wrist", "thumbBase"],
  ["thumbBase", "thumbKnuckle"],
  ["thumbKnuckle", "thumbJoint"],
  ["thumbJoint", "thumbTip"],
  ["wrist", "indexKnuckle"],
  ["indexKnuckle", "middleKnuckle"],
  ["middleKnuckle", "ringKnuckle"],
  ["ringKnuckle", "pinkyKnuckle"],
  ["wrist", "pinkyKnuckle"],
  ...finger("index"),
  ...finger("middle"),
  ...finger("ring"),
  ...finger("pinky"),
];

function jointSide(name: string): Side {
  return name.startsWith("left") ? "left" : name.startsWith("right") ? "right" : "center";
}

/** The host shows the camera mirrored, so the figure is mirrored the same way. */
function place(point: { x: number; y: number }, cover: Cover) {
  return { x: cover.left + (1 - point.x) * cover.width, y: cover.top + point.y * cover.height };
}

export function figures(frame: Frame, cover: Cover): Figures {
  const segments: Array<Figures["segments"][number]> = [];
  const dots: Array<Figures["dots"][number]> = [];
  const labels: Array<Figures["labels"][number]> = [];

  for (const body of frame.bodies) {
    for (const [from, to, side] of bodyBones) {
      const a = body[from];
      const b = body[to];
      if (!a || !b) continue;
      const start = place(a, cover);
      const end = place(b, cover);
      segments.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, side });
    }
    for (const [name, joint] of Object.entries(body))
      dots.push({ ...place(joint, cover), side: jointSide(name) });
  }

  for (const { side, points } of frame.hands) {
    for (const [from, to] of handBones) {
      const start = place(points[from], cover);
      const end = place(points[to], cover);
      segments.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, side });
    }
    for (const point of Object.values(points)) dots.push({ ...place(point, cover), side });
    labels.push({
      ...place(points.wrist, cover),
      side,
      text: side === "left" ? "Esquerda" : "Direita",
    });
  }
  return { segments, dots, labels };
}

function bodyPointers(body: Body, cover: Cover): ControlPoint[] {
  return (["left", "right"] as const).flatMap((side) => {
    const joint = body[`${side}Index`] ?? body[`${side}Wrist`];
    return joint ? [{ key: side, ...place(joint, cover) }] : [];
  });
}

function handPointers(hands: readonly Hand[], cover: Cover): ControlPoint[] {
  // Two hands may carry the same side, so the side alone is not a key.
  return hands.map(({ side, points }, index) => ({
    key: `${side}${index}`,
    ...place(points.indexTip, cover),
  }));
}

/** What presses this bench's buttons: an index fingertip from whichever model is running. */
export function pointers(frame: Frame, cover: Cover): ControlPoint[] {
  return [
    ...frame.bodies.flatMap((body) => bodyPointers(body, cover)),
    ...handPointers(frame.hands, cover),
  ];
}

/** A button's place on screen, in viewport pixels. */
export interface Target {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A cell counts as person from half confidence up. */
const PERSON = 128;
/** How much of a button the silhouette must cover to be holding it. */
const HOLD_COVERAGE = 0.25;
const SAMPLES_ACROSS = 8;
const SAMPLES_DOWN = 4;

function isPerson(silhouette: Silhouette, cover: Cover, x: number, y: number): boolean {
  const column = Math.floor((1 - (x - cover.left) / cover.width) * silhouette.width);
  const row = Math.floor(((y - cover.top) / cover.height) * silhouette.height);
  if (column < 0 || row < 0 || column >= silhouette.width || row >= silhouette.height) return false;
  return (silhouette.alpha[row * silhouette.width + column] ?? 0) >= PERSON;
}

/** The share of the camera image that is person, from 0 to 1. */
export function coverage(silhouette: Silhouette): number {
  let cells = 0;
  for (const value of silhouette.alpha) if (value >= PERSON) cells += 1;
  return cells / silhouette.alpha.length;
}

/**
 * With no fingertip to point with, a silhouette presses a button by covering it: the one pointer
 * sits on the most covered button, or off screen while none is covered enough.
 */
export function silhouettePointer(
  silhouette: Silhouette,
  cover: Cover,
  targets: readonly Target[],
): ControlPoint {
  let best: Target | null = null;
  let most = HOLD_COVERAGE;
  for (const target of targets) {
    let covered = 0;
    for (let down = 0; down < SAMPLES_DOWN; down += 1) {
      for (let across = 0; across < SAMPLES_ACROSS; across += 1) {
        const x = target.left + ((across + 0.5) / SAMPLES_ACROSS) * target.width;
        const y = target.top + ((down + 0.5) / SAMPLES_DOWN) * target.height;
        if (isPerson(silhouette, cover, x, y)) covered += 1;
      }
    }
    const share = covered / (SAMPLES_ACROSS * SAMPLES_DOWN);
    if (share >= most) {
      most = share;
      best = target;
    }
  }
  return best
    ? { key: "silhouette", x: best.left + best.width / 2, y: best.top + best.height / 2 }
    : { key: "silhouette", x: -1, y: -1 };
}
