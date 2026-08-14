import { describe, expect, it } from "vitest";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import {
  BUBBLES_HAND_HIT_RADIUS,
  BUBBLES_MAX_RADIUS,
  BUBBLES_MAX_SPEED,
  BUBBLES_MIN_RADIUS,
  BUBBLES_MIN_SPEED,
  BUBBLES_POP_DURATION_MS,
  BUBBLES_RESPAWN_MAX_MS,
  BUBBLES_ROUND_DURATION_MS,
  BUBBLES_STARTING_DURATION_MS,
  BUBBLES_TARGET_COUNTS,
  bubblesPlayersFromPosePacket,
  type BubblesPlayerInput,
  BubblesSession,
} from "../../src/games/bubbles/bubbles-session";
import type { Point, Size } from "../../src/render/geometry";

const FRAME: Size = { width: 1_280, height: 720 };

function lcg(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function sequenceRandom(values: readonly number[], fallbackSeed = 7): () => number {
  const fallback = lcg(fallbackSeed);
  let index = 0;
  return () => values[index++] ?? fallback();
}

function player(
  side: "left" | "right",
  left: Point | null = null,
  right: Point | null = null,
): BubblesPlayerInput {
  return {
    side,
    torso: { x: side === "left" ? 0.3 : 0.7, y: 0.5 },
    hands: { left, right },
  };
}

function readySession(playerCount: 1 | 2 = 1, randomSource: () => number = lcg(3)): BubblesSession {
  const session = new BubblesSession(randomSource);
  session.setEnabled(true, playerCount, 0);
  session.updatePlayers(
    playerCount === 1 ? [player("right")] : [player("left"), player("right")],
    FRAME,
    0,
    0,
  );
  return session;
}

function handPointsAcrossBubble(point: Point): { from: Point; to: Point } {
  const horizontalOffset = (0.13 * Math.min(FRAME.width, FRAME.height)) / FRAME.width;
  if (point.x > horizontalOffset && point.x < 1 - horizontalOffset) {
    return {
      from: { x: point.x - horizontalOffset, y: point.y },
      to: { x: point.x + horizontalOffset, y: point.y },
    };
  }
  const verticalOffset = (0.13 * Math.min(FRAME.width, FRAME.height)) / FRAME.height;
  return {
    from: { x: point.x, y: point.y - verticalOffset },
    to: { x: point.x, y: point.y + verticalOffset },
  };
}

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function setLandmark(pose: DetectedPose, index: number, x: number, y: number): void {
  const landmark = pose.landmarks[index];
  if (landmark === undefined) {
    throw new Error(`Missing landmark ${index}.`);
  }
  Object.assign(landmark, { x, y, visibility: 1 });
}

function poseAt(rawX: number): DetectedPose {
  const pose: DetectedPose = { landmarks: Array.from({ length: 33 }, hiddenLandmark) };
  for (const [index, x, y] of [
    [11, rawX - 0.05, 0.3],
    [12, rawX + 0.05, 0.3],
    [23, rawX - 0.04, 0.65],
    [24, rawX + 0.04, 0.65],
    [15, rawX - 0.05, 0.42],
    [17, rawX - 0.06, 0.41],
    [19, rawX - 0.05, 0.4],
    [21, rawX - 0.04, 0.41],
    [16, rawX + 0.05, 0.42],
    [18, rawX + 0.04, 0.41],
    [20, rawX + 0.05, 0.4],
    [22, rawX + 0.06, 0.41],
  ] as const) {
    setLandmark(pose, index, x, y);
  }
  return pose;
}

function packet(poses: DetectedPose[]): PosePacket {
  return { sequence: 1, capturedAtMs: 100, frame: FRAME, poses };
}

describe("Bubbles session", () => {
  it("requires the configured players and uses exact countdown and round deadlines", () => {
    const session = new BubblesSession(lcg(1));
    session.setEnabled(true, 2, 0);
    expect(session.updatePlayers([player("left")], FRAME, 0, 0)).toMatchObject({
      phase: "ready",
      visiblePlayers: 1,
      readyToStart: false,
    });
    expect(session.start(0)).toMatchObject({ started: false, reason: "not-ready" });

    session.updatePlayers([player("left"), player("right")], FRAME, 1, 1);
    const started = session.start(10);
    expect(started).toMatchObject({
      started: true,
      snapshot: { phase: "starting", startingRemainingMs: 3_000 },
    });
    expect(started.snapshot.bubbles).toHaveLength(BUBBLES_TARGET_COUNTS[2]);
    expect(session.tick(10 + BUBBLES_STARTING_DURATION_MS - 1).phase).toBe("starting");
    expect(session.tick(10 + BUBBLES_STARTING_DURATION_MS)).toMatchObject({
      phase: "playing",
      roundRemainingMs: BUBBLES_ROUND_DURATION_MS,
    });
    expect(
      session.tick(10 + BUBBLES_STARTING_DURATION_MS + BUBBLES_ROUND_DURATION_MS - 1),
    ).toMatchObject({ phase: "playing", roundRemainingMs: 1 });
    expect(
      session.tick(10 + BUBBLES_STARTING_DURATION_MS + BUBBLES_ROUND_DURATION_MS),
    ).toMatchObject({
      phase: "finished",
      roundRemainingMs: 0,
      result: { type: "winner", winner: "tie", leftScore: 0, rightScore: 0 },
    });
  });

  it("keeps every complete bubble in bounds and reflects an outward edge velocity", () => {
    const outwardFirstBubble = sequenceRandom([
      0.5,
      0.9999,
      0.5,
      0.9,
      0.999,
      1.15 / 1.7,
      0.4,
      0.3,
      0.7,
    ]);
    const session = readySession(1, outwardFirstBubble);
    const started = session.start(0);
    if (!started.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const initial = started.snapshot.bubbles[0];
    expect(initial).toBeDefined();
    expect(Math.hypot(initial?.velocity.x ?? 0, initial?.velocity.y ?? 0)).toBeGreaterThanOrEqual(
      BUBBLES_MIN_SPEED,
    );
    expect(Math.hypot(initial?.velocity.x ?? 0, initial?.velocity.y ?? 0)).toBeLessThanOrEqual(
      BUBBLES_MAX_SPEED,
    );

    const reflected = session.tick(100).bubbles[0];
    expect(reflected?.velocity.x).toBeLessThan(0);
    for (let nowMs = 100; nowMs < 62_900; nowMs += 100) {
      const snapshot = session.tick(nowMs);
      for (const bubble of snapshot.bubbles) {
        const radiusX = (bubble.radius * Math.min(FRAME.width, FRAME.height)) / FRAME.width;
        const radiusY = (bubble.radius * Math.min(FRAME.width, FRAME.height)) / FRAME.height;
        expect(bubble.radius).toBeGreaterThanOrEqual(BUBBLES_MIN_RADIUS);
        expect(bubble.radius).toBeLessThanOrEqual(BUBBLES_MAX_RADIUS);
        expect(bubble.point.x).toBeGreaterThanOrEqual(radiusX);
        expect(bubble.point.x).toBeLessThanOrEqual(1 - radiusX);
        expect(bubble.point.y).toBeGreaterThanOrEqual(radiusY);
        expect(bubble.point.y).toBeLessThanOrEqual(1 - radiusY);
      }
    }
  });

  it("scores one point once, completes the pop, and restores the target population", () => {
    const session = readySession();
    const started = session.start(0);
    if (!started.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const playing = session.tick(BUBBLES_STARTING_DURATION_MS);
    const target = playing.bubbles[0];
    if (target === undefined) {
      throw new Error("Expected a target bubble.");
    }

    const popped = session.updatePlayers(
      [player("left", target.point)],
      FRAME,
      BUBBLES_STARTING_DURATION_MS + 1,
      BUBBLES_STARTING_DURATION_MS + 1,
    );
    expect(popped.scores.right).toBe(1);
    expect(popped.bubbles.find(({ id }) => id === target.id)?.state).toBe("popping");
    expect(
      session.updatePlayers(
        [player("left", target.point)],
        FRAME,
        BUBBLES_STARTING_DURATION_MS + 1,
        BUBBLES_STARTING_DURATION_MS + 2,
      ).scores.right,
    ).toBe(1);

    expect(
      session.tick(BUBBLES_STARTING_DURATION_MS + 1 + BUBBLES_POP_DURATION_MS).bubbles,
    ).toHaveLength(BUBBLES_TARGET_COUNTS[1] - 1);
    expect(
      session.tick(BUBBLES_STARTING_DURATION_MS + 1 + BUBBLES_RESPAWN_MAX_MS).bubbles,
    ).toHaveLength(BUBBLES_TARGET_COUNTS[1]);
  });

  it("uses a fresh swept hand segment but rejects the same stale segment", () => {
    const freshSession = readySession(1, lcg(11));
    const freshStart = freshSession.start(0);
    if (!freshStart.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const freshTarget = freshSession.tick(BUBBLES_STARTING_DURATION_MS + 100).bubbles[0];
    if (freshTarget === undefined) {
      throw new Error("Expected a target bubble.");
    }
    const freshPath = handPointsAcrossBubble(freshTarget.point);
    expect(
      freshSession.updatePlayers(
        [player("right", freshPath.from)],
        FRAME,
        BUBBLES_STARTING_DURATION_MS + 100,
        BUBBLES_STARTING_DURATION_MS + 100,
      ).scores.right,
    ).toBe(0);
    expect(
      freshSession.updatePlayers(
        [player("right", freshPath.to)],
        FRAME,
        BUBBLES_STARTING_DURATION_MS + 133,
        BUBBLES_STARTING_DURATION_MS + 133,
      ).scores.right,
    ).toBe(1);

    const staleSession = readySession(1, lcg(11));
    const staleStart = staleSession.start(0);
    if (!staleStart.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const staleTarget = staleSession.tick(BUBBLES_STARTING_DURATION_MS + 100).bubbles[0];
    if (staleTarget === undefined) {
      throw new Error("Expected a target bubble.");
    }
    const stalePath = handPointsAcrossBubble(staleTarget.point);
    staleSession.updatePlayers(
      [player("right", stalePath.from)],
      FRAME,
      BUBBLES_STARTING_DURATION_MS + 100,
      BUBBLES_STARTING_DURATION_MS + 100,
    );
    expect(
      staleSession.updatePlayers(
        [player("right", stalePath.to)],
        FRAME,
        BUBBLES_STARTING_DURATION_MS + 351,
        BUBBLES_STARTING_DURATION_MS + 351,
      ).scores.right,
    ).toBe(0);
  });

  it("attributes two-player pops to screen sides and declares the winner", () => {
    const session = readySession(2, lcg(21));
    const started = session.start(0);
    if (!started.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const playing = session.tick(BUBBLES_STARTING_DURATION_MS);
    const target = playing.bubbles[0];
    if (target === undefined) {
      throw new Error("Expected a target bubble.");
    }
    const scored = session.updatePlayers(
      [player("left", target.point), player("right")],
      FRAME,
      BUBBLES_STARTING_DURATION_MS + 1,
      BUBBLES_STARTING_DURATION_MS + 1,
    );
    expect(scored.scores).toEqual({ left: 1, right: 0 });
    expect(scored.lastPopAtMs).toEqual({ left: BUBBLES_STARTING_DURATION_MS + 1, right: null });
    const finished = session.tick(BUBBLES_STARTING_DURATION_MS + BUBBLES_ROUND_DURATION_MS);
    expect(finished.result).toEqual({
      type: "winner",
      winner: "left",
      leftScore: 1,
      rightScore: 0,
    });

    const restarted = session.start(BUBBLES_STARTING_DURATION_MS + BUBBLES_ROUND_DURATION_MS);
    expect(restarted).toMatchObject({
      started: true,
      snapshot: {
        phase: "starting",
        scores: { left: 0, right: 0 },
        lastPopAtMs: { left: null, right: null },
      },
    });
    expect(restarted.snapshot.bubbles).toHaveLength(BUBBLES_TARGET_COUNTS[2]);
  });

  it("breaks swept input on non-increasing samples and camera-frame aspect changes", () => {
    const nonIncreasingSession = readySession(1, lcg(11));
    const nonIncreasingStart = nonIncreasingSession.start(0);
    if (!nonIncreasingStart.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const target = nonIncreasingSession.tick(BUBBLES_STARTING_DURATION_MS + 100).bubbles[0];
    if (target === undefined) {
      throw new Error("Expected a target bubble.");
    }
    const path = handPointsAcrossBubble(target.point);
    nonIncreasingSession.updatePlayers(
      [player("right", path.from)],
      FRAME,
      BUBBLES_STARTING_DURATION_MS + 100,
      BUBBLES_STARTING_DURATION_MS + 100,
    );
    nonIncreasingSession.updatePlayers(
      [player("right", path.from)],
      FRAME,
      BUBBLES_STARTING_DURATION_MS + 100,
      BUBBLES_STARTING_DURATION_MS + 101,
    );
    expect(
      nonIncreasingSession.updatePlayers(
        [player("right", path.to)],
        FRAME,
        BUBBLES_STARTING_DURATION_MS + 133,
        BUBBLES_STARTING_DURATION_MS + 133,
      ).scores.right,
    ).toBe(0);

    const frameChangeSession = readySession(1, lcg(11));
    const frameChangeStart = frameChangeSession.start(0);
    if (!frameChangeStart.started) {
      throw new Error("Expected Bubbles to start.");
    }
    const frameChangeTarget = frameChangeSession.tick(BUBBLES_STARTING_DURATION_MS + 100)
      .bubbles[0];
    if (frameChangeTarget === undefined) {
      throw new Error("Expected a target bubble.");
    }
    const frameChangePath = handPointsAcrossBubble(frameChangeTarget.point);
    frameChangeSession.updatePlayers(
      [player("right", frameChangePath.from)],
      FRAME,
      BUBBLES_STARTING_DURATION_MS + 100,
      BUBBLES_STARTING_DURATION_MS + 100,
    );
    const portraitFrame = { width: 720, height: 1_280 };
    const changed = frameChangeSession.updatePlayers(
      [player("right", frameChangePath.to)],
      portraitFrame,
      BUBBLES_STARTING_DURATION_MS + 133,
      BUBBLES_STARTING_DURATION_MS + 133,
    );
    expect(changed.scores.right).toBe(0);
    for (const bubble of changed.bubbles) {
      const radiusX =
        (bubble.radius * Math.min(portraitFrame.width, portraitFrame.height)) / portraitFrame.width;
      const radiusY =
        (bubble.radius * Math.min(portraitFrame.width, portraitFrame.height)) /
        portraitFrame.height;
      expect(bubble.point.x).toBeGreaterThanOrEqual(radiusX);
      expect(bubble.point.x).toBeLessThanOrEqual(1 - radiusX);
      expect(bubble.point.y).toBeGreaterThanOrEqual(radiusY);
      expect(bubble.point.y).toBeLessThanOrEqual(1 - radiusY);
    }
  });

  it("derives mirrored identity-independent slots and complete hands from pose packets", () => {
    const screenRight = poseAt(0.25);
    const screenLeft = poseAt(0.75);
    const players = bubblesPlayersFromPosePacket(packet([screenRight, screenLeft]), 2);

    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({ side: "left", torso: { x: 0.25 } });
    expect(players[1]).toMatchObject({ side: "right", torso: { x: 0.75 } });
    expect(players[0]?.hands.left?.x).toBeCloseTo(0.3);
    expect(players[1]?.hands.right?.x).toBeCloseTo(0.7);

    const fallback = bubblesPlayersFromPosePacket(packet([screenLeft]), 2);
    expect(fallback[0]?.side).toBe("left");
    const single = bubblesPlayersFromPosePacket(packet([screenLeft, screenRight]), 1);
    expect(single).toHaveLength(1);
    expect(single[0]?.side).toBe("right");
  });

  it("ignores out-of-frame hands and validates the injected random boundary", () => {
    const session = new BubblesSession(() => 1);
    session.setEnabled(true, 1, 0);
    const snapshot = session.updatePlayers(
      [player("right", { x: 1 + BUBBLES_HAND_HIT_RADIUS, y: 0.5 })],
      FRAME,
      0,
      0,
    );
    expect(snapshot.hands).toHaveLength(0);
    expect(() => session.start(0)).toThrow(/random source must return/);

    const outOfFramePose = poseAt(-0.75);
    expect(bubblesPlayersFromPosePacket(packet([outOfFramePose]), 1)).toHaveLength(0);
  });
});
