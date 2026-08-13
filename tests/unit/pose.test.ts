import { describe, expect, it } from "vitest";
import { acceptIncreasingSequence, parsePosePacket, type PosePacket } from "../../src/domain/pose";

function validPacket(): PosePacket {
  return {
    sequence: 7,
    capturedAtMs: 1234.5,
    frame: { width: 1280, height: 720 },
    poses: [
      {
        landmarks: Array.from({ length: 33 }, (_, index) => ({
          x: index / 32,
          y: 0.5,
          z: -0.1,
          visibility: 0.9,
        })),
      },
    ],
  };
}

describe("pose packet parser", () => {
  it("accepts and clones the exact packet contract", () => {
    const packet = validPacket();
    const result = parsePosePacket(packet);

    expect(result).toEqual({ ok: true, value: packet });
    if (result.ok) {
      expect(result.value).not.toBe(packet);
      expect(result.value.poses[0]?.landmarks).not.toBe(packet.poses[0]?.landmarks);
    }
  });

  it("accepts empty and two-person detections", () => {
    const empty = validPacket();
    empty.poses = [];
    expect(parsePosePacket(empty).ok).toBe(true);

    const twoPeople = validPacket();
    const firstPose = twoPeople.poses[0];
    if (firstPose === undefined) {
      throw new Error("Fixture is missing a pose.");
    }
    twoPeople.poses.push(structuredClone(firstPose));
    expect(parsePosePacket(twoPeople).ok).toBe(true);
  });

  it("rejects extensions at every schema boundary", () => {
    const topLevel = { ...validPacket(), version: 1 };
    const frame = validPacket() as PosePacket & {
      frame: PosePacket["frame"] & { rotation: number };
    };
    frame.frame.rotation = 0;
    const landmark = validPacket() as PosePacket;
    Object.assign(landmark.poses[0]?.landmarks[0] ?? {}, { name: "nose" });

    expect(parsePosePacket(topLevel).ok).toBe(false);
    expect(parsePosePacket(frame).ok).toBe(false);
    expect(parsePosePacket(landmark).ok).toBe(false);
  });

  it("rejects malformed counts and numeric values", () => {
    const shortPose = validPacket();
    shortPose.poses[0]?.landmarks.pop();
    expect(parsePosePacket(shortPose).ok).toBe(false);

    const tooMany = validPacket();
    const pose = tooMany.poses[0];
    if (pose === undefined) {
      throw new Error("Fixture is missing a pose.");
    }
    tooMany.poses = [pose, structuredClone(pose), structuredClone(pose)];
    expect(parsePosePacket(tooMany).ok).toBe(false);

    const invalidVisibility = validPacket();
    const firstLandmark = invalidVisibility.poses[0]?.landmarks[0];
    if (firstLandmark !== undefined) {
      firstLandmark.visibility = 1.01;
    }
    expect(parsePosePacket(invalidVisibility).ok).toBe(false);

    const nonFinite = validPacket();
    nonFinite.capturedAtMs = Number.NaN;
    expect(parsePosePacket(nonFinite).ok).toBe(false);
  });
});

describe("pose packet ordering", () => {
  it("accepts only a strictly increasing sequence", () => {
    expect(acceptIncreasingSequence(-1, 0)).toBe(0);
    expect(acceptIncreasingSequence(8, 9)).toBe(9);
    expect(acceptIncreasingSequence(8, 8)).toBeNull();
    expect(acceptIncreasingSequence(8, 7)).toBeNull();
  });
});
