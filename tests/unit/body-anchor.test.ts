import type { Body, BodyFrame } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { findAnchor, MENU_REACH, menuLayout } from "../../apps/jojixplay/src/domain/body-anchor";

const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
const cover = { left: 0, top: 0, width: 1000, height: 500 };
const frame = (bodies: Body[]): BodyFrame => ({
  sequence: 1,
  capturedAtMs: 0,
  width: 1000,
  height: 500,
  epoch: 0,
  bodies,
});
const person = (center: number): Body => ({
  leftShoulder: joint(center + 0.05, 0.5),
  rightShoulder: joint(center - 0.05, 0.5),
});

it("anchors to the most central player with both shoulders, mirrored onto the screen", () => {
  const found = findAnchor(
    frame([person(0.8), person(0.4), { leftShoulder: joint(0.5, 0.5) }]),
    cover,
  );
  expect(found?.anchor.x).toBeCloseTo(600);
  expect(found?.anchor.y).toBeCloseTo(250);
  expect(found?.anchor.unit).toBeCloseTo(100);
  expect(findAnchor(frame([{ leftWrist: joint(0.5, 0.5) }]), cover)).toBeNull();
});

type Spot = { x: number; y: number; size: number };
const inside = (spot: Spot, x: number, y: number) =>
  Math.abs(x - spot.x) <= spot.size / 2 && Math.abs(y - spot.y) <= spot.size / 2;
function cards(layout: ReturnType<typeof menuLayout>): Spot[] {
  return [-1, 0, 1].map((place) => ({
    ...layout.card,
    x: layout.card.x + place * layout.spacing,
  }));
}

it("keeps every object out of a relaxed arm's reach and inside a stretched arm's reach", () => {
  const anchor = { x: 500, y: 300, unit: 100 };
  const layout = menuLayout(anchor, 1000, 600);
  const [left, middle, right] = cards(layout);
  if (!left || !middle || !right) throw new Error("Missing cards");
  // A hanging hand: beside the hip, more than a shoulder width below the shoulders.
  for (const x of [440, 560])
    for (const spot of [left, middle, right, layout.previous, layout.next])
      expect(inside(spot, x, 430)).toBe(false);
  // A child's arm is about 1.35 shoulder widths from shoulder to wrist: straight up for the
  // middle card, up and outwards for its neighbours, sideways for a bubble.
  expect(inside(middle, 500, 300 - 135 - 15)).toBe(true);
  expect(inside(left, 500 - 50 - 70, 300 - 115)).toBe(true);
  expect(inside(right, 500 + 50 + 70, 300 - 115)).toBe(true);
  expect(inside(layout.previous, 500 - 50 - 135, 300)).toBe(true);
  expect(inside(layout.next, 500 + 50 + 135, 300)).toBe(true);
  // The three cards do not overlap, and the end previews sit beyond them.
  expect(middle.x - left.x).toBeGreaterThan(middle.size);
  expect(layout.peekOffset).toBeGreaterThan(layout.spacing + middle.size / 2);
});

it("keeps objects on screen and large enough to see when the player is far or near an edge", () => {
  const layout = menuLayout({ x: 40, y: 60, unit: 30 }, 800, 400);
  expect(layout.card.size).toBe(MENU_REACH.minCardPx);
  expect(layout.previous.size).toBe(MENU_REACH.minBubblePx);
  expect(layout.card.y - layout.card.size / 2).toBeGreaterThanOrEqual(MENU_REACH.edgePx);
  // The whole row, end previews included, stays on screen.
  const peekHalf = (layout.card.size * MENU_REACH.peekSize) / 2;
  expect(layout.card.x - layout.peekOffset - peekHalf).toBeGreaterThanOrEqual(MENU_REACH.edgePx);
  expect(layout.previous.x - layout.previous.size / 2).toBeGreaterThanOrEqual(MENU_REACH.edgePx);
  expect(layout.next.x).toBeGreaterThan(layout.previous.x);
});

it("stops growing the buttons when the player comes close to the camera", () => {
  const near = menuLayout({ x: 400, y: 300, unit: 150 }, 800, 400);
  const nearer = menuLayout({ x: 400, y: 300, unit: 400 }, 800, 400);
  expect(near.card.size).toBe(400 * MENU_REACH.maxCardHeightShare);
  expect(nearer.card.size).toBe(near.card.size);
  expect(nearer.previous.size).toBe(400 * MENU_REACH.maxBubbleHeightShare);
  // A narrow screen still fits all five places.
  const narrow = menuLayout({ x: 200, y: 300, unit: 150 }, 400, 400);
  expect(narrow.card.x + narrow.peekOffset).toBeLessThan(400);
  expect(narrow.card.x - narrow.peekOffset).toBeGreaterThan(0);
});

it("slides the side bubbles down, never into the card row, as the shoulders near the top", () => {
  const clear = (layout: ReturnType<typeof menuLayout>) =>
    layout.previous.y - layout.previous.size / 2 - (layout.card.y + layout.card.size / 2);
  // With room above the head the bubbles sit at shoulder height.
  expect(menuLayout({ x: 400, y: 300, unit: 80 }, 800, 400).previous.y).toBe(300);
  // Shoulders rising towards the top edge: the bubbles move down smoothly and keep their gap.
  let previousY = 0;
  for (const y of [200, 150, 100, 50, 10]) {
    const layout = menuLayout({ x: 400, y, unit: 150 }, 800, 400);
    expect(clear(layout)).toBeGreaterThan(0);
    expect(layout.previous.y).toBe(layout.next.y);
    if (previousY) expect(Math.abs(layout.previous.y - previousY)).toBeLessThanOrEqual(50);
    previousY = layout.previous.y;
  }
});
