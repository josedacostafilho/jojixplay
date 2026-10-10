import { type Frame, type Hand, type HandPointName, handPointNames } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { coverage, figures, pointers, silhouettePointer, worldFigures } from "../src/figures";

const cover = { left: -100, top: 0, width: 1000, height: 500 };
/** Projection is floating point; the expectations are whole pixels. */
function whole<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "number" ? Math.round(item) : item)),
  );
}
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
function frame(input: Partial<Frame>): Frame {
  return {
    sequence: 0,
    capturedAtMs: 0,
    width: 1280,
    height: 720,
    epoch: 0,
    sensing: "body",
    bodies: [],
    worldBodies: [],
    hands: [],
    silhouette: null,
    ...input,
  };
}
function hand(side: Hand["side"], x: number): Hand {
  return {
    side,
    confidence: 1,
    points: Object.fromEntries(
      handPointNames.map((name, index) => [name, { x, y: 0.9 - index * 0.01, z: 0 }]),
    ) as Record<HandPointName, { x: number; y: number; z: number }>,
  };
}

it("draws a body mirrored like the camera image and coloured by the person's own side", () => {
  const drawn = whole(
    figures(
      frame({ bodies: [{ leftShoulder: joint(0.6, 0.4), leftElbow: joint(0.7, 0.6) }] }),
      cover,
    ),
  );
  expect(drawn.dots).toEqual([
    { x: 300, y: 200, side: "left" },
    { x: 200, y: 300, side: "left" },
  ]);
  expect(drawn.segments).toEqual([{ x1: 300, y1: 200, x2: 200, y2: 300, side: "left" }]);
});

it("keeps every sensed joint when a neighbour is missing, drawing only bones with both ends", () => {
  const drawn = whole(
    figures(
      frame({
        bodies: [
          {
            leftShoulder: joint(0.6, 0.4),
            rightShoulder: joint(0.4, 0.4),
            leftWrist: joint(0.7, 0.8),
          },
        ],
      }),
      cover,
    ),
  );
  expect(drawn.dots).toHaveLength(3);
  expect(drawn.segments).toEqual([{ x1: 300, y1: 200, x2: 500, y2: 200, side: "center" }]);
});

it("draws both hands with every finger and names each by the person's own side", () => {
  const drawn = whole(
    figures(frame({ sensing: "hands", hands: [hand("left", 0.7), hand("right", 0.3)] }), cover),
  );
  expect(drawn.dots).toHaveLength(42);
  // Four thumb bones, three for each other finger and five across the palm, per hand.
  expect(drawn.segments).toHaveLength(42);
  expect(drawn.labels).toEqual([
    { x: 200, y: 450, side: "left", text: "Esquerda" },
    { x: 600, y: 450, side: "right", text: "Direita" },
  ]);
});

it("presses buttons with an index fingertip from whichever model is running", () => {
  expect(
    whole(
      pointers(
        frame({
          bodies: [
            {
              leftWrist: joint(0.6, 0.5),
              rightWrist: joint(0.4, 0.5),
              rightIndex: joint(0.3, 0.4),
            },
          ],
        }),
        cover,
      ),
    ),
  ).toEqual([
    { key: "left", x: 300, y: 250 },
    { key: "right", x: 600, y: 200 },
  ]);
  // Two hands given the same side must still be two pointers.
  expect(
    whole(
      pointers(frame({ sensing: "hands", hands: [hand("left", 0.7), hand("left", 0.3)] }), cover),
    ),
  ).toEqual([
    { key: "left0", x: 200, y: 410 },
    { key: "left1", x: 600, y: 410 },
  ]);
});

/** A 10 by 5 grid with the person filling the given camera columns. */
function shape(from: number, to: number) {
  const alpha = new Uint8Array(50);
  for (let row = 0; row < 5; row += 1)
    for (let column = from; column < to; column += 1) alpha[row * 10 + column] = 255;
  return { width: 10, height: 5, alpha };
}

it("lets a silhouette hold the button it covers, mirrored like the camera image", () => {
  // cover spans x -100..900, so camera columns 8-9 (x 0.8..1) show at screen x -100..100.
  const left = { left: 0, top: 0, width: 100, height: 50 };
  const right = { left: 700, top: 0, width: 100, height: 50 };
  expect(silhouettePointer(shape(8, 10), cover, [left, right])).toEqual({
    key: "silhouette",
    x: 50,
    y: 25,
  });
  expect(silhouettePointer(shape(0, 2), cover, [left, right])).toMatchObject({ x: 750, y: 25 });
  expect(coverage(shape(8, 10))).toBeCloseTo(0.2);
});

it("keeps the pointer off every button until enough of one is covered", () => {
  const button = { left: 300, top: 0, width: 400, height: 50 };
  // Camera columns 2-5 show at screen x 300..700.
  expect(silhouettePointer(shape(4, 5), cover, [button])).toMatchObject({ x: 350 + 150, y: 25 });
  const sliver = shape(4, 5);
  sliver.alpha.fill(100);
  expect(silhouettePointer(sliver, cover, [button])).toEqual({ key: "silhouette", x: -1, y: -1 });
  expect(silhouettePointer(shape(0, 0), cover, [button])).toEqual({
    key: "silhouette",
    x: -1,
    y: -1,
  });
});

it("draws a body in its own space from the front, the side and above, on one scale", () => {
  const at = (x: number, y: number, z: number) => ({ x, y, z, confidence: 1 });
  // The person's left shoulder: to the camera image's right, above the hips. Their left wrist
  // is held half a metre in front of them.
  const drawn = whole(
    worldFigures(
      frame({
        worldBodies: [{ leftShoulder: at(0.19, -0.57, 0), leftWrist: at(0.19, -0.57, -0.5) }],
      }),
      { left: 60, width: 1200, height: 475 },
    ),
  );
  // Three views 380 px wide beside the buttons, 200 px to the metre, hips at 266 px down.
  const [front, side, above] = [0, 1, 2].map((view) => drawn.dots.slice(view * 2, view * 2 + 2));
  // From the front the two coincide, mirrored like the camera image: depth cannot be seen.
  expect(front).toEqual([
    { x: 212, y: 152, side: "left" },
    { x: 212, y: 152, side: "left" },
  ]);
  // From the side the wrist is nearer the camera, which is to the left.
  expect(side).toEqual([
    { x: 630, y: 152, side: "left" },
    { x: 530, y: 152, side: "left" },
  ]);
  // From above the wrist is nearer the camera, which is below.
  expect(above).toEqual([
    { x: 972, y: 266, side: "left" },
    { x: 972, y: 366, side: "left" },
  ]);
  // No bone joins a shoulder to a wrist without the elbow.
  expect(drawn.segments).toEqual([]);
  expect(drawn.labels.map((label) => label.text)).toEqual([
    "De frente",
    "De lado · câmera à esquerda",
    "De cima · câmera embaixo",
    "50 cm",
  ]);
});
