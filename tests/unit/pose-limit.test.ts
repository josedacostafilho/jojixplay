import { expect, it } from "vitest";
import { isPoseLimit } from "../../apps/jojixplay/src/domain/pose-limit";
it("accepts only one or two players", () => {
  expect([1, 2].every(isPoseLimit)).toBe(true);
  expect([0, 3, "1", null].some(isPoseLimit)).toBe(false);
});
