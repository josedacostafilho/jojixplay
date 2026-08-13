import { describe, expect, it } from "vitest";
import { parsePoseLimitMessage } from "../../src/domain/pose-limit";

describe("player-limit message parser", () => {
  it.each([1, 2] as const)("accepts the supported absolute limit %s", (poseLimit) => {
    expect(parsePoseLimitMessage({ poseLimit })).toEqual({
      ok: true,
      value: { poseLimit },
    });
  });

  it.each([
    null,
    [],
    {},
    { poseLimit: 0 },
    { poseLimit: 3 },
    { poseLimit: "2" },
    { poseLimit: 1, legacy: true },
  ])("rejects malformed and obsolete shapes", (value) => {
    expect(parsePoseLimitMessage(value).ok).toBe(false);
  });
});
