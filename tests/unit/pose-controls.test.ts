import { describe, expect, it } from "vitest";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import {
  type PoseControlActionDefinition,
  POSE_CONTROL_TIMING,
  PoseControlSession,
  type PoseControlTarget,
} from "../../src/interaction/pose-controls";
import type { Point, Size } from "../../src/render/geometry";

const VIEWPORT: Size = { width: 1_280, height: 720 };
const FRAME = { width: 1_280, height: 720 };
type TestAction = "background" | "players" | "games" | "draw" | "return" | "clear";
const TEST_ACTIONS = [
  { action: "background", label: "Background" },
  { action: "players", label: "Players" },
  { action: "games", label: "Games" },
] as const satisfies readonly PoseControlActionDefinition<TestAction>[];

function createSession(): PoseControlSession<TestAction> {
  return new PoseControlSession<TestAction>(TEST_ACTIONS);
}

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

function hideLandmark(pose: DetectedPose, index: number): void {
  const landmark = pose.landmarks[index];
  if (landmark === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  landmark.visibility = 0;
}

function createPose(horizontalOffset = 0): DetectedPose {
  const pose: DetectedPose = {
    landmarks: Array.from({ length: 33 }, hiddenLandmark),
  };
  setLandmark(pose, 0, 0.5 + horizontalOffset, 0.16);
  setLandmark(pose, 11, 0.4 + horizontalOffset, 0.3);
  setLandmark(pose, 12, 0.6 + horizontalOffset, 0.3);
  setLandmark(pose, 13, 0.4 + horizontalOffset, 0.5);
  setLandmark(pose, 14, 0.6 + horizontalOffset, 0.5);
  setLandmark(pose, 15, 0.4 + horizontalOffset, 0.2);
  setLandmark(pose, 16, 0.6 + horizontalOffset, 0.55);
  setLandmark(pose, 17, 0.38 + horizontalOffset, 0.18);
  setLandmark(pose, 18, 0.58 + horizontalOffset, 0.57);
  setLandmark(pose, 19, 0.4 + horizontalOffset, 0.17);
  setLandmark(pose, 20, 0.6 + horizontalOffset, 0.58);
  setLandmark(pose, 21, 0.42 + horizontalOffset, 0.18);
  setLandmark(pose, 22, 0.62 + horizontalOffset, 0.57);
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

function claimSinglePerson(
  session: PoseControlSession<TestAction>,
  pose: DetectedPose,
  startMs = 0,
) {
  session.updatePacket(packet([pose]), startMs, VIEWPORT);
  session.updatePacket(packet([pose]), startMs + 100, VIEWPORT);
  session.updatePacket(packet([pose]), startMs + 200, VIEWPORT);
  return session.updatePacket(
    packet([pose]),
    startMs + POSE_CONTROL_TIMING.singlePersonClaimMs,
    VIEWPORT,
  );
}

function targetCenter(target: PoseControlTarget<TestAction>): Point {
  return {
    x: target.rect.x + target.rect.width / 2,
    y: target.rect.y + target.rect.height / 2,
  };
}

function moveLeftHandToScreen(pose: DetectedPose, point: Point): DetectedPose {
  const moved = clonePose(pose);
  for (const index of [15, 17, 19, 21]) {
    setLandmark(moved, index, 1 - point.x / VIEWPORT.width, point.y / VIEWPORT.height);
  }
  return moved;
}

describe("television pose controls", () => {
  it("freezes targets above the visible head and points from the coarse hand center", () => {
    const session = createSession();
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
    expect(middleTarget.rect.y + middleTarget.rect.height).toBeLessThan(0.16 * VIEWPORT.height);
    expect(claimed.snapshot.pointer?.x).toBeCloseTo(768);
    expect(claimed.snapshot.pointer?.y).toBeCloseTo(131.4);
    expect(claimed.snapshot.hands).toMatchObject({
      selected: "left",
      left: { x: 0.4, y: 0.1825 },
      right: { x: 0.6, y: 0.5675 },
    });
    expect(claimed.snapshot.controlsArmed).toBe(false);

    const loweredHand = moveLeftHandToScreen(pose, { x: 768, y: 324 });
    const moved = session.updatePacket(packet([loweredHand]), 400, VIEWPORT);

    expect(moved.snapshot.phase).toBe("active");
    expect(moved.snapshot.targets).toBe(claimed.snapshot.targets);
    expect(moved.snapshot.pointer?.y).toBeCloseTo(324);
    expect(moved.snapshot.controlsArmed).toBe(true);
  });

  it("requires visible headroom before a control claim can begin", () => {
    const session = createSession();
    const pose = createPose();
    setLandmark(pose, 0, 0.5, 0.04);

    for (const timeMs of [0, 100, 200, 300]) {
      expect(session.updatePacket(packet([pose]), timeMs, VIEWPORT).snapshot).toMatchObject({
        phase: "needs-headroom",
        claimProgress: 0,
        targets: [],
      });
    }

    setLandmark(pose, 0, 0.5, 0.16);
    expect(session.updatePacket(packet([pose]), 400, VIEWPORT).snapshot.phase).toBe("claiming");
  });

  it("uses the selected right coarse hand symmetrically", () => {
    const session = createSession();
    const pose = createPose();
    for (const index of [15, 17, 19, 21]) {
      setLandmark(pose, index, 0.4, 0.56);
    }
    for (const index of [16, 18, 20, 22]) {
      setLandmark(pose, index, 0.6, 0.18);
    }

    const claimed = claimSinglePerson(session, pose);

    expect(claimed.snapshot.phase).toBe("active");
    expect(claimed.snapshot.pointer?.x).toBeCloseTo(512);
    expect(claimed.snapshot.pointer?.y).toBeCloseTo(129.6);
  });

  it("requires a deliberate two-hand claim when multiple people are visible", () => {
    const session = createSession();
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
    const session = createSession();
    const pose = createPose();
    const claimed = claimSinglePerson(session, pose);
    const target = claimed.snapshot.targets[0];
    if (target === undefined) {
      throw new Error("Expected a control target.");
    }
    const hoveringPose = moveLeftHandToScreen(pose, targetCenter(target));

    expect(session.updatePacket(packet([pose]), 350, VIEWPORT).snapshot.controlsArmed).toBe(true);

    expect(session.updatePacket(packet([hoveringPose]), 400, VIEWPORT).activated).toBeNull();
    for (const timeMs of [600, 800, 1_000, 1_200]) {
      expect(session.updatePacket(packet([hoveringPose]), timeMs, VIEWPORT).activated).toBeNull();
    }
    const activated = session.updatePacket(
      packet([hoveringPose]),
      400 + POSE_CONTROL_TIMING.dwellMs,
      VIEWPORT,
    );
    expect(activated.activated).toBe("background");
    expect(activated.snapshot.dwellProgress).toBe(1);
    expect(session.updatePacket(packet([hoveringPose]), 1_350, VIEWPORT).activated).toBeNull();

    session.updatePacket(packet([pose]), 1_450, VIEWPORT);
    expect(session.updatePacket(packet([hoveringPose]), 1_500, VIEWPORT).activated).toBeNull();
    for (const timeMs of [1_700, 1_900, 2_100, 2_300]) {
      session.updatePacket(packet([hoveringPose]), timeMs, VIEWPORT);
    }
    expect(
      session.updatePacket(packet([hoveringPose]), 1_500 + POSE_CONTROL_TIMING.dwellMs, VIEWPORT)
        .activated,
    ).toBe("background");
  });

  it("replaces the complete action set without releasing the lease and requires neutral re-arming", () => {
    const session = createSession();
    const pose = createPose();
    const claimed = claimSinglePerson(session, pose);
    const originalTargets = claimed.snapshot.targets;
    expect(session.updatePacket(packet([pose]), 350, VIEWPORT).snapshot.controlsArmed).toBe(true);

    const transitioned = session.setActions(
      [
        { action: "draw", label: "Draw" },
        { action: "return", label: "Return" },
      ],
      360,
    );

    expect(transitioned.snapshot).toMatchObject({
      phase: "active",
      controlsArmed: false,
      hoveredAction: null,
      controllerPoseIndex: 0,
    });
    expect(transitioned.snapshot.targets).not.toBe(originalTargets);
    expect(transitioned.snapshot.targets.map(({ action }) => action)).toEqual(["draw", "return"]);
    expect(transitioned.snapshot.targets[0]?.rect.y).toBe(originalTargets[0]?.rect.y);
    expect(session.tick(365).snapshot.controlsArmed).toBe(false);
    expect(session.updatePacket(packet([pose]), 370, VIEWPORT).snapshot.controlsArmed).toBe(true);
  });

  it("honors an action-specific dwell duration", () => {
    const session = createSession();
    const pose = createPose();
    claimSinglePerson(session, pose);
    session.setActions([{ action: "clear", label: "Clear", dwellMs: 1_500 }], 310);
    session.updatePacket(packet([pose]), 350, VIEWPORT);
    const target = session.tick(351).snapshot.targets[0];
    if (target === undefined) {
      throw new Error("Expected the Clear target.");
    }
    const hoveringPose = moveLeftHandToScreen(pose, targetCenter(target));

    expect(session.updatePacket(packet([hoveringPose]), 400, VIEWPORT).activated).toBeNull();
    expect(session.updatePacket(packet([hoveringPose]), 1_300, VIEWPORT).activated).toBeNull();
    expect(session.updatePacket(packet([hoveringPose]), 1_899, VIEWPORT).activated).toBeNull();
    expect(session.updatePacket(packet([hoveringPose]), 1_900, VIEWPORT).activated).toBe("clear");
  });

  it("rejects empty, duplicate, oversized, and invalid-duration action sets", () => {
    expect(() => new PoseControlSession<TestAction>([])).toThrow(/require 1 to 3 actions/);
    expect(
      () =>
        new PoseControlSession<TestAction>([
          { action: "draw", label: "Draw" },
          { action: "draw", label: "Again" },
        ]),
    ).toThrow(/Duplicate pose-control action/);
    expect(
      () =>
        new PoseControlSession<TestAction>([
          { action: "background", label: "Background" },
          { action: "players", label: "Players" },
          { action: "games", label: "Games" },
          { action: "draw", label: "Draw" },
        ]),
    ).toThrow(/require 1 to 3 actions/);
    expect(
      () => new PoseControlSession<TestAction>([{ action: "clear", label: "Clear", dwellMs: 0 }]),
    ).toThrow(/invalid dwell time/);
  });

  it("will not dwell until the claiming hand has left every spawned target", () => {
    const session = createSession();
    const pose = createPose();
    const claimed = claimSinglePerson(session, pose);
    const target = claimed.snapshot.targets[1];
    if (target === undefined) {
      throw new Error("Expected a control target.");
    }
    const hoveringPose = moveLeftHandToScreen(pose, targetCenter(target));

    for (const timeMs of [350, 700, 1_300]) {
      const update = session.updatePacket(packet([hoveringPose]), timeMs, VIEWPORT);
      expect(update.activated).toBeNull();
      expect(update.snapshot.controlsArmed).toBe(false);
      expect(update.snapshot.dwellProgress).toBe(0);
    }

    const armed = session.updatePacket(packet([pose]), 1_350, VIEWPORT);
    expect(armed.snapshot.controlsArmed).toBe(true);
    expect(armed.snapshot.hoveredAction).toBeNull();
  });

  it("pauses the pointer and resets dwell instead of falling back when the hand cluster is lost", () => {
    const session = createSession();
    const pose = createPose();
    const claimed = claimSinglePerson(session, pose);
    const target = claimed.snapshot.targets[0];
    if (target === undefined) {
      throw new Error("Expected a control target.");
    }
    const hoveringPose = moveLeftHandToScreen(pose, targetCenter(target));
    session.updatePacket(packet([pose]), 350, VIEWPORT);
    session.updatePacket(packet([hoveringPose]), 400, VIEWPORT);
    expect(session.updatePacket(packet([hoveringPose]), 700, VIEWPORT).snapshot.dwellProgress).toBe(
      1 / 3,
    );

    const incompleteHand = clonePose(hoveringPose);
    hideLandmark(incompleteHand, 19);
    const paused = session.updatePacket(packet([incompleteHand]), 750, VIEWPORT);
    expect(paused.snapshot.phase).toBe("active");
    expect(paused.snapshot.pointer).toBeNull();
    expect(paused.snapshot.hoveredAction).toBeNull();
    expect(paused.snapshot.dwellProgress).toBe(0);

    expect(session.updatePacket(packet([hoveringPose]), 800, VIEWPORT).activated).toBeNull();
    expect(session.updatePacket(packet([hoveringPose]), 1_600, VIEWPORT).activated).toBeNull();
    expect(
      session.updatePacket(packet([hoveringPose]), 800 + POSE_CONTROL_TIMING.dwellMs, VIEWPORT)
        .activated,
    ).toBe("background");
  });

  it("releases control after a sustained wrist-below-hips gesture", () => {
    const session = createSession();
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
    const session = createSession();
    const pose = createPose();
    claimSinglePerson(session, pose);

    expect(session.updatePacket(null, 400, VIEWPORT).snapshot.phase).toBe("active");
    expect(session.tick(1_299).snapshot.phase).toBe("active");
    expect(session.tick(300 + POSE_CONTROL_TIMING.poseLostReleaseMs + 1).snapshot.phase).toBe(
      "no-pose",
    );

    claimSinglePerson(session, pose, 2_000);
    const resized = session.updatePacket(packet([pose]), 2_400, { width: 1_000, height: 700 });
    expect(resized.snapshot.phase).toBe("needs-headroom");
    expect(resized.snapshot.targets).toHaveLength(0);
  });

  it("releases a lease when the torso remains far from its frozen layout", () => {
    const session = createSession();
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
    const session = createSession();
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
