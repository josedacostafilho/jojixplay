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

it("keeps every object out of a relaxed arm's reach and inside a stretched arm's reach", () => {
  const anchor = { x: 500, y: 300, unit: 100 };
  const { card, previous, next } = menuLayout(anchor, 1000);
  const inside = (spot: typeof card, x: number, y: number) =>
    Math.abs(x - spot.x) <= spot.size / 2 && Math.abs(y - spot.y) <= spot.size / 2;
  // A hanging hand: beside the hip, more than a shoulder width below the shoulders.
  for (const x of [440, 560])
    for (const spot of [card, previous, next]) expect(inside(spot, x, 430)).toBe(false);
  // A child's arm is about 1.35 shoulder widths from shoulder to wrist.
  expect(inside(card, 500, 300 - 135 - 15)).toBe(true);
  expect(inside(previous, 500 - 50 - 135, 300)).toBe(true);
  expect(inside(next, 500 + 50 + 135, 300)).toBe(true);
});

it("keeps objects on screen and large enough to see when the player is far or near an edge", () => {
  const { card, previous, next } = menuLayout({ x: 40, y: 60, unit: 30 }, 800);
  expect(card.size).toBe(MENU_REACH.minCardPx);
  expect(previous.size).toBe(MENU_REACH.minBubblePx);
  expect(card.y - card.size / 2).toBeGreaterThanOrEqual(MENU_REACH.edgePx);
  expect(previous.x - previous.size / 2).toBeGreaterThanOrEqual(MENU_REACH.edgePx);
  expect(next.x).toBeGreaterThan(previous.x);
});
