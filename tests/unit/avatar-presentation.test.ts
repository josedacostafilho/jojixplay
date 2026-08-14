import { describe, expect, it } from "vitest";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import {
  AVATAR_PRESENTATION_TIMING,
  AvatarPresentationSession,
} from "../../src/render/avatar-presentation";

function landmark(x = 0.5, y = 0.5, z = 0, visibility = 1): PoseLandmark {
  return { x, y, z, visibility };
}

function pose(): DetectedPose {
  return { landmarks: Array.from({ length: 33 }, () => landmark()) };
}

function packet(
  sequence: number,
  capturedAtMs: number,
  poses: DetectedPose[],
  width = 1_000,
  height = 1_000,
): PosePacket {
  return { sequence, capturedAtMs, frame: { width, height }, poses };
}

function setLandmark(source: DetectedPose, index: number, values: Partial<PoseLandmark>): void {
  const target = source.landmarks[index];
  if (target === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  Object.assign(target, values);
}

function outputLandmark(frame: ReturnType<AvatarPresentationSession["update"]>, index: number) {
  const output = frame?.poses[0]?.landmarks[index];
  if (output === undefined) {
    throw new Error(`Missing output landmark ${index}.`);
  }
  return output;
}

describe("Avatar presentation session", () => {
  it("makes an immutable display copy, smooths small motion, and follows fast motion closely", () => {
    const session = new AvatarPresentationSession();
    const firstPose = pose();
    setLandmark(firstPose, 0, { x: 0.2 });
    const firstPacket = packet(1, 0, [firstPose]);
    const first = session.update(firstPacket);

    expect(first).not.toBe(firstPacket);
    expect(first?.frame).not.toBe(firstPacket.frame);
    expect(first?.poses[0]).not.toBe(firstPose);
    expect(outputLandmark(first, 0)).not.toBe(firstPose.landmarks[0]);

    const slowPose = pose();
    setLandmark(slowPose, 0, { x: 0.205 });
    const slow = session.update(packet(2, 100, [slowPose]));
    const slowX = outputLandmark(slow, 0).x;
    expect(slowX).toBeGreaterThan(0.2);
    expect(slowX).toBeLessThan(0.205);

    const fastPose = pose();
    setLandmark(fastPose, 0, { x: 0.4 });
    const fastPacket = packet(3, 200, [fastPose]);
    const before = structuredClone(fastPacket);
    const fast = session.update(fastPacket);
    const fastX = outputLandmark(fast, 0).x;
    const slowResponse = (slowX - 0.2) / (0.205 - 0.2);
    const fastResponse = (fastX - slowX) / (0.4 - slowX);
    expect(fastResponse).toBeGreaterThan(slowResponse);
    expect(fastX).toBeGreaterThan(0.395);
    expect(fastPacket).toEqual(before);
  });

  it("returns the cached display frame for a duplicate sequence", () => {
    const session = new AvatarPresentationSession();
    const first = session.update(packet(7, 100, [pose()]));
    const changedDuplicate = pose();
    setLandmark(changedDuplicate, 0, { x: 0.9 });

    expect(session.update(packet(7, 120, [changedDuplicate]))).toBe(first);
    expect(outputLandmark(first, 0).x).toBe(0.5);
  });

  it("starts from current data after capture gaps, frame changes, and unusable landmarks", () => {
    const session = new AvatarPresentationSession();
    session.update(packet(1, 0, [pose()]));

    const afterGapPose = pose();
    setLandmark(afterGapPose, 0, { x: 0.7 });
    const afterGap = session.update(
      packet(2, AVATAR_PRESENTATION_TIMING.maximumContinuationGapMs + 1, [afterGapPose]),
    );
    expect(outputLandmark(afterGap, 0).x).toBe(0.7);

    const changedFramePose = pose();
    setLandmark(changedFramePose, 0, { x: 0.3 });
    const changedFrame = session.update(packet(3, 300, [changedFramePose], 1_280, 720));
    expect(outputLandmark(changedFrame, 0).x).toBe(0.3);

    const hiddenPose = pose();
    setLandmark(hiddenPose, 0, { x: 0.9, visibility: 0 });
    expect(outputLandmark(session.update(packet(4, 400, [hiddenPose], 1_280, 720)), 0)).toEqual(
      hiddenPose.landmarks[0],
    );

    const returnedPose = pose();
    setLandmark(returnedPose, 0, { x: 0.6 });
    expect(outputLandmark(session.update(packet(5, 500, [returnedPose], 1_280, 720)), 0).x).toBe(
      0.6,
    );
  });

  it("bounds limb-length correction and propagates it to descendants", () => {
    const session = new AvatarPresentationSession();
    const firstPose = pose();
    setLandmark(firstPose, 11, { x: 0.3 });
    setLandmark(firstPose, 13, { x: 0.4 });
    setLandmark(firstPose, 15, { x: 0.5 });
    for (const index of [17, 19, 21]) {
      setLandmark(firstPose, index, { x: 0.52 });
    }
    session.update(packet(1, 0, [firstPose]));

    const stretchedPose = structuredClone(firstPose);
    setLandmark(stretchedPose, 13, { x: 0.52 });
    setLandmark(stretchedPose, 15, { x: 0.62 });
    for (const index of [17, 19, 21]) {
      setLandmark(stretchedPose, index, { x: 0.64 });
    }
    const output = session.update(packet(2, 100, [stretchedPose]));
    const shoulderX = outputLandmark(output, 11).x;
    const elbowX = outputLandmark(output, 13).x;
    const wristX = outputLandmark(output, 15).x;
    const handX = outputLandmark(output, 19).x;

    const alpha = 1 - Math.exp(-100 / AVATAR_PRESENTATION_TIMING.fastSmoothingTimeMs);
    const coordinateOnlyElbowX = 0.4 + (0.52 - 0.4) * alpha;
    const coordinateOnlyLength = coordinateOnlyElbowX - 0.3;
    const correctedLength = elbowX - shoulderX;
    expect(correctedLength).toBeLessThan(coordinateOnlyLength);
    expect(correctedLength).toBeGreaterThanOrEqual(
      coordinateOnlyLength * (1 - AVATAR_PRESENTATION_TIMING.maximumSegmentCorrectionRatio) - 1e-9,
    );
    expect(handX - wristX).toBeCloseTo(0.02, 5);
  });

  it("uses depth hysteresis for one pose and no temporal association for multiple poses", () => {
    const session = new AvatarPresentationSession();
    const leftNear = pose();
    for (const index of [11, 13, 15, 23, 25, 27]) {
      setLandmark(leftNear, index, { z: -0.05 });
    }
    expect(session.update(packet(1, 0, [leftNear]))?.poses[0]?.nearSide).toBe("left");

    const ambiguousFlip = pose();
    for (const index of [12, 14, 16, 24, 26, 28]) {
      setLandmark(ambiguousFlip, index, { z: -0.02 });
    }
    expect(session.update(packet(2, 100, [ambiguousFlip]))?.poses[0]?.nearSide).toBe("left");

    const clearFlip = pose();
    for (const index of [12, 14, 16, 24, 26, 28]) {
      setLandmark(clearFlip, index, { z: -0.08 });
    }
    expect(session.update(packet(3, 200, [clearFlip]))?.poses[0]?.nearSide).toBe("right");

    const firstMultiPose = pose();
    const secondMultiPose = pose();
    setLandmark(firstMultiPose, 0, { x: 0.1 });
    setLandmark(secondMultiPose, 0, { x: 0.9 });
    const multiple = session.update(packet(4, 300, [firstMultiPose, secondMultiPose]));
    expect(multiple?.poses.map(({ sourcePoseIndex }) => sourcePoseIndex)).toEqual([0, 1]);
    expect(outputLandmark(multiple, 0).x).toBe(0.1);
    expect(multiple?.poses[1]?.landmarks[0]?.x).toBe(0.9);

    const nextFirstMultiPose = structuredClone(firstMultiPose);
    const nextSecondMultiPose = structuredClone(secondMultiPose);
    setLandmark(nextFirstMultiPose, 0, { x: 0.35 });
    setLandmark(nextSecondMultiPose, 0, { x: 0.65 });
    const nextMultiple = session.update(packet(5, 400, [nextSecondMultiPose, nextFirstMultiPose]));
    expect(outputLandmark(nextMultiple, 0).x).toBe(0.65);
    expect(nextMultiple?.poses[1]?.landmarks[0]?.x).toBe(0.35);

    const oneAgain = pose();
    setLandmark(oneAgain, 0, { x: 0.75 });
    expect(outputLandmark(session.update(packet(6, 500, [oneAgain])), 0).x).toBe(0.75);
  });

  it("clears all history when the input is absent", () => {
    const session = new AvatarPresentationSession();
    session.update(packet(1, 0, [pose()]));
    expect(session.update(null)).toBeNull();
    const returned = pose();
    setLandmark(returned, 0, { x: 0.8 });
    expect(outputLandmark(session.update(packet(2, 100, [returned])), 0).x).toBe(0.8);
  });
});
