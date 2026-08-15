import { describe, expect, it } from "vitest";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import { PoseDiagnosticsMonitor } from "../../src/pose/pose-diagnostics";

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function setLandmark(pose: DetectedPose, index: number, x: number, y: number): void {
  const landmark = pose.landmarks[index];
  if (landmark === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  Object.assign(landmark, { x, y, visibility: 1 });
}

function packet(capturedAtMs: number, thumbOffset = 0): PosePacket {
  const pose: DetectedPose = { landmarks: Array.from({ length: 33 }, hiddenLandmark) };
  for (const [index, x, y] of [
    [15, 0.4, 0.4],
    [17, 0.4, 0.4],
    [19, 0.4, 0.4],
    [21, 0.4 + thumbOffset, 0.4],
    [16, 0.6, 0.4],
    [18, 0.6, 0.4],
    [20, 0.6, 0.4],
    [22, 0.6, 0.4],
  ] as const) {
    setLandmark(pose, index, x, y);
  }
  return {
    sequence: capturedAtMs,
    capturedAtMs,
    frame: { width: 1_280, height: 720, layout: "landscape", epoch: 0 },
    poses: [pose],
  };
}

describe("pose diagnostics", () => {
  it("reports bounded phone-local orientation normalization metadata", () => {
    const monitor = new PoseDiagnosticsMonitor();
    monitor.recordCameraNormalization({
      source: { width: 720, height: 1_280 },
      rotation: 90,
      frame: { width: 1_280, height: 720, layout: "landscape", epoch: 3 },
      screen: { type: "landscape-primary", layout: "landscape", angle: 90 },
    });

    expect(monitor.snapshot(0).orientation).toEqual({
      screenType: "landscape-primary",
      screenAngle: 90,
      sourceWidth: 720,
      sourceHeight: 1_280,
      appliedRotation: 90,
      canonicalWidth: 1_280,
      canonicalHeight: 720,
      layout: "landscape",
      epoch: 3,
    });
    monitor.reset();
    expect(monitor.snapshot(0).orientation).toBeNull();
  });

  it("reports rolling pipeline rates, processing age, and one-player hand spread", () => {
    const monitor = new PoseDiagnosticsMonitor();
    for (let atMs = 0; atMs <= 2_000; atMs += 100) {
      monitor.recordCameraFrame(atMs);
      monitor.recordInferenceSubmission(atMs);
      monitor.recordInferenceCompletion(
        packet(atMs, atMs % 200 === 0 ? 0.01 : -0.01),
        atMs + 40,
        1,
      );
    }

    const snapshot = monitor.snapshot(2_040);
    expect(snapshot.frame).toEqual({
      width: 1_280,
      height: 720,
      layout: "landscape",
      epoch: 0,
    });
    expect(snapshot.cameraFramesPerSecond).toBeCloseTo(10);
    expect(snapshot.inferenceSubmissionsPerSecond).toBeCloseTo(10);
    expect(snapshot.inferenceCompletionsPerSecond).toBeCloseTo(10);
    expect(snapshot.processingMedianMs).toBe(40);
    expect(snapshot.processingP95Ms).toBe(40);
    expect(snapshot.leftHand).toMatchObject({
      sampleCount: 20,
      worstLandmark: "thumb",
    });
    expect(snapshot.leftHand?.worstLandmarkP95Px).toBeGreaterThan(
      snapshot.leftHand?.centerP95Px ?? Number.POSITIVE_INFINITY,
    );
    expect(snapshot.rightHand?.centerP95Px).toBe(0);
  });

  it("withholds hand statistics outside one-player inference", () => {
    const monitor = new PoseDiagnosticsMonitor();
    for (let atMs = 0; atMs <= 500; atMs += 100) {
      monitor.recordInferenceCompletion(packet(atMs), atMs + 20, 2);
    }

    expect(monitor.snapshot(520)).toMatchObject({ leftHand: null, rightHand: null });
  });

  it("breaks the hand window on dropout and camera-basis changes", () => {
    const monitor = new PoseDiagnosticsMonitor();
    for (let atMs = 0; atMs <= 500; atMs += 100) {
      monitor.recordInferenceCompletion(packet(atMs), atMs + 20, 1);
    }
    expect(monitor.snapshot(520).leftHand?.sampleCount).toBe(6);

    const dropout = { ...packet(600), poses: [] };
    monitor.recordInferenceCompletion(dropout, 620, 1);
    expect(monitor.snapshot(620).leftHand).toBeNull();

    for (let atMs = 700; atMs <= 1_200; atMs += 100) {
      monitor.recordInferenceCompletion(packet(atMs), atMs + 20, 1);
    }
    expect(monitor.snapshot(1_220).leftHand?.sampleCount).toBe(6);

    const resized: PosePacket = {
      ...packet(1_300),
      frame: { width: 1_280, height: 720, layout: "landscape", epoch: 1 },
    };
    monitor.recordInferenceCompletion(resized, 1_320, 1);
    expect(monitor.snapshot(1_320).leftHand).toBeNull();
  });

  it("keeps every diagnostic window bounded to two seconds", () => {
    const monitor = new PoseDiagnosticsMonitor();
    for (let atMs = 0; atMs <= 2_000; atMs += 100) {
      monitor.recordCameraFrame(atMs);
    }
    monitor.recordCameraFrame(5_000);

    expect(monitor.snapshot(5_000).cameraFramesPerSecond).toBeNull();
  });
});
