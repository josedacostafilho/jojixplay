import { describe, expect, it } from "vitest";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import {
  POSE_CONTROL_TIMING,
  PoseControlSession,
  type PoseControlTarget,
} from "../../src/interaction/pose-controls";
import type { Point, Size } from "../../src/render/geometry";

const VIEWPORT: Size = { width: 1_280, height: 720 };
const FRAME = { width: 1_280, height: 720 };

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function setLandmark(pose: DetectedPose, index: number, x: number, y: number): void {
  const landmark = pose.landmarks[index];
  if (landmark === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  landmark.x = x;
  landmark.y = y;
  landmark.visibility = 1;
}

function createPose(horizontalOffset = 0): DetectedPose {
  const pose: DetectedPose = {
    landmarks: Array.from({ length: 33 }, hiddenLandmark),
  };
  setLandmark(pose, 11, 0.4 + horizontalOffset, 0.3);
  setLandmark(pose, 12, 0.6 + horizontalOffset, 0.3);
  setLandmark(pose, 13, 0.4 + horizontalOffset, 0.5);
  setLandmark(pose, 14, 0.6 + horizontalOffset, 0.5);
  setLandmark(pose, 15, 0.4 + horizontalOffset, 0.2);
  setLandmark(pose, 16, 0.6 + horizontalOffset, 0.55);
  setLandmark(pose, 23, 0.43 + horizontalOffset, 0.65);
  setLandmark(pose, 24, 0.57 + horizontalOffset, 0.65);
  return pose;
}

function clonePose(pose: DetectedPose): DetectedPose {
  return { landmarks: pose.landmarks.map((landmark) => ({ ...landmark })) };
}

function packet(poses: DetectedPose[]): PosePacket {
  return { sequence: 0, capturedAtMs: 0, frame: FRAME, poses };
}

function claimSinglePerson(session: PoseControlSession, pose: DetectedPose, startMs = 0) {
  session.updatePacket(packet([pose]), startMs, VIEWPORT);
  session.updatePacket(packet([pose]), startMs + 100, VIEWPORT);
  session.updatePacket(packet([pose]), startMs + 200, VIEWPORT);
  return session.updatePacket(
    packet([pose]),
    startMs + POSE_CONTROL_TIMING.singlePersonClaimMs,
    VIEWPORT,
  );
}

function targetCenter(target: PoseControlTarget): Point {
  return {
    x: target.rect.x + target.rect.width / 2,
    y: target.rect.y + target.rect.height / 2,
  };
}

function moveLeftWristToScreen(pose: DetectedPose, point: Point): DetectedPose {
  const moved = clonePose(pose);
  setLandmark(moved, 15, 1 - point.x / VIEWPORT.width, point.y / VIEWPORT.height);
  return moved;
}

describe("television pose controls", () => {
  it("claims one raised hand and freezes a mirrored torso-relative target row", () => {
    const session = new PoseControlSession();
    const pose = createPose();

    expect(session.updatePacket(packet([pose]), 0, VIEWPORT).snapshot.phase).toBe("claiming");
    expect(session.updatePacket(packet([pose]), 100, VIEWPORT).snapshot.phase).toBe("claiming");
    expect(session.updatePacket(packet([pose]), 200, VIEWPORT).snapshot.phase).toBe("claiming");
    const claimed = session.updatePacket(packet([pose]), 300, VIEWPORT);

    expect(claimed.snapshot.phase).toBe("active");
    expect(claimed.snapshot.targets).toHaveLength(3);
    const middleTarget = claimed.snapshot.targets[1];
    if (middleTarget === undefined) {
      throw new Error("Expected the middle control target.");
    }
    expect(targetCenter(middleTarget).x).toBeCloseTo(640);
    expect(targetCenter(middleTarget).y).toBeCloseTo(279);
    expect(claimed.snapshot.pointer?.x).toBeCloseTo(768);

    const loweredHand = clonePose(pose);
    setLandmark(loweredHand, 15, 0.4, 0.45);
    const moved = session.updatePacket(packet([loweredHand]), 400, VIEWPORT);

    expect(moved.snapshot.phase).toBe("active");
    expect(moved.snapshot.targets).toBe(claimed.snapshot.targets);
    expect(moved.snapshot.pointer?.y).toBeCloseTo(324);
  });

  it("requires a deliberate two-hand claim when multiple people are visible", () => {
    const session = new PoseControlSession();
    const first = createPose(-0.2);
    const second = createPose(0.2);

    expect(session.updatePacket(packet([first, second]), 0, VIEWPORT).snapshot).toMatchObject({
      phase: "ready",
      visiblePeople: 2,
      requiresBothHands: true,
    });

    const claimingFirst = clonePose(first);
    const claimingSecond = clonePose(second);
    setLandmark(claimingFirst, 16, 0.4, 0.2);
    setLandmark(claimingSecond, 16, 0.8, 0.2);
    session.updatePacket(packet([claimingFirst, claimingSecond]), 100, VIEWPORT);
    session.updatePacket(packet([claimingFirst, claimingSecond]), 300, VIEWPORT);
    session.updatePacket(packet([claimingFirst, claimingSecond]), 500, VIEWPORT);
    const claimed = session.updatePacket(
      packet([claimingFirst, claimingSecond]),
      100 + POSE_CONTROL_TIMING.multiplePeopleClaimMs,
      VIEWPORT,
    );

    expect(claimed.snapshot.phase).toBe("active");
    expect(claimed.snapshot.visiblePeople).toBe(2);
  });

  it("activates a dwell target once and requires leaving before reactivation", () => {
    const session = new PoseControlSession();
    const pose = createPose();
    const claimed = claimSinglePerson(session, pose);
    const target = claimed.snapshot.targets[0];
    if (target === undefined) {
      throw new Error("Expected a control target.");
    }
    const hoveringPose = moveLeftWristToScreen(pose, targetCenter(target));

    expect(session.updatePacket(packet([hoveringPose]), 350, VIEWPORT).activated).toBeNull();
    for (const timeMs of [550, 750, 950, 1_150]) {
      expect(session.updatePacket(packet([hoveringPose]), timeMs, VIEWPORT).activated).toBeNull();
    }
    const activated = session.updatePacket(
      packet([hoveringPose]),
      350 + POSE_CONTROL_TIMING.dwellMs,
      VIEWPORT,
    );
    expect(activated.activated).toBe("background");
    expect(activated.snapshot.dwellProgress).toBe(1);
    expect(session.updatePacket(packet([hoveringPose]), 1_350, VIEWPORT).activated).toBeNull();

    const outsidePose = clonePose(pose);
    setLandmark(outsidePose, 15, 0.05, 0.1);
    session.updatePacket(packet([outsidePose]), 1_450, VIEWPORT);
    expect(session.updatePacket(packet([hoveringPose]), 1_500, VIEWPORT).activated).toBeNull();
    for (const timeMs of [1_700, 1_900, 2_100, 2_300]) {
      session.updatePacket(packet([hoveringPose]), timeMs, VIEWPORT);
    }
    expect(
      session.updatePacket(packet([hoveringPose]), 1_500 + POSE_CONTROL_TIMING.dwellMs, VIEWPORT)
        .activated,
    ).toBe("background");
  });

  it("releases control after a sustained wrist-below-hips gesture", () => {
    const session = new PoseControlSession();
    const pose = createPose();
    expect(claimSinglePerson(session, pose).snapshot.phase).toBe("active");
    const releasePose = clonePose(pose);
    setLandmark(releasePose, 15, 0.4, 0.75);

    expect(session.updatePacket(packet([releasePose]), 400, VIEWPORT).snapshot.phase).toBe(
      "active",
    );
    expect(session.updatePacket(packet([releasePose]), 700, VIEWPORT).snapshot.phase).toBe(
      "active",
    );
    expect(
      session.updatePacket(
        packet([releasePose]),
        400 + POSE_CONTROL_TIMING.belowHipsReleaseMs,
        VIEWPORT,
      ).snapshot.phase,
    ).not.toBe("active");
  });

  it("releases a lost pose and resets an active lease when the viewport changes", () => {
    const session = new PoseControlSession();
    const pose = createPose();
    claimSinglePerson(session, pose);

    expect(session.updatePacket(null, 400, VIEWPORT).snapshot.phase).toBe("active");
    expect(session.tick(1_299).snapshot.phase).toBe("active");
    expect(session.tick(300 + POSE_CONTROL_TIMING.poseLostReleaseMs + 1).snapshot.phase).toBe(
      "no-pose",
    );

    claimSinglePerson(session, pose, 2_000);
    const resized = session.updatePacket(packet([pose]), 2_400, { width: 1_000, height: 700 });
    expect(resized.snapshot.phase).toBe("claiming");
    expect(resized.snapshot.targets).toHaveLength(0);
  });

  it("releases a lease when the torso remains far from its frozen layout", () => {
    const session = new PoseControlSession();
    const pose = createPose();
    claimSinglePerson(session, pose);
    const displaced = createPose(0.25);

    expect(session.updatePacket(packet([displaced]), 400, VIEWPORT).snapshot.phase).toBe("active");
    expect(session.updatePacket(packet([displaced]), 700, VIEWPORT).snapshot.phase).toBe("active");
    expect(
      session.updatePacket(
        packet([displaced]),
        400 + POSE_CONTROL_TIMING.displacedReleaseMs,
        VIEWPORT,
      ).snapshot.phase,
    ).not.toBe("active");
  });

  it("releases an otherwise fresh but inactive pointer", () => {
    const session = new PoseControlSession();
    const pose = createPose();
    claimSinglePerson(session, pose);

    for (let timeMs = 500; timeMs <= POSE_CONTROL_TIMING.inactivityReleaseMs; timeMs += 200) {
      expect(session.updatePacket(packet([pose]), timeMs, VIEWPORT).snapshot.phase).toBe("active");
    }
    session.updatePacket(packet([pose]), POSE_CONTROL_TIMING.inactivityReleaseMs + 300, VIEWPORT);
    expect(session.tick(POSE_CONTROL_TIMING.inactivityReleaseMs + 301).snapshot.phase).not.toBe(
      "active",
    );
  });
});
