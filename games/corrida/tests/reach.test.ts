import { expect, it } from "vitest";
import { reachableHand } from "../src/reach";

it("maps a central wrist workspace to reachable screen edges without needing other joints", () => {
  expect(reachableHand(0.5, 0.45)).toEqual({ x: 0.5, y: 0.5 });
  expect(reachableHand(0.75, 0.15)).toEqual({ x: 0.02, y: 0.02 });
  expect(reachableHand(0.25, 0.75)).toEqual({ x: 0.98, y: 0.98 });
});
