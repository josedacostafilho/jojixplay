import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { PoseDiagnosticsPanel } from "../../src/components/pose-diagnostics-panel";
import type { PoseDiagnosticsSnapshot } from "../../src/pose/pose-diagnostics";

const DIAGNOSTICS: PoseDiagnosticsSnapshot = {
  frame: { width: 1_280, height: 720, layout: "landscape", epoch: 2 },
  orientation: {
    screenType: "landscape-primary",
    screenAngle: 90,
    sourceWidth: 720,
    sourceHeight: 1_280,
    appliedRotation: 90,
    canonicalWidth: 1_280,
    canonicalHeight: 720,
    layout: "landscape",
    epoch: 2,
  },
  cameraFramesPerSecond: 30,
  inferenceSubmissionsPerSecond: 24,
  inferenceCompletionsPerSecond: 24,
  processingMedianMs: 35,
  processingP95Ms: 48,
  leftHand: {
    sampleCount: 48,
    windowMs: 1_960,
    centerP95Px: 7.2,
    worstLandmark: "index",
    worstLandmarkP95Px: 12.4,
  },
  rightHand: null,
};

afterEach(cleanup);

describe("pose diagnostics panel", () => {
  it("is collapsed by default and explains its local motion-inclusive measurements", () => {
    const view = render(<PoseDiagnosticsPanel diagnostics={DIAGNOSTICS} poseLimit={1} />);
    const details = view.container.querySelector("details");

    expect(details).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Pose diagnostics"));
    expect(details).toHaveAttribute("open");
    expect(screen.getByText(/Hand spread includes real movement/)).toBeInTheDocument();
    expect(screen.getByText("30.0 / second")).toBeInTheDocument();
    expect(screen.getByText("35 ms median · 48 ms p95")).toBeInTheDocument();
    expect(screen.getByText("1280 × 720 · landscape · epoch 2")).toBeInTheDocument();
    expect(
      screen.getByText("landscape-primary · 90° screen · 720 × 1280 source"),
    ).toBeInTheDocument();
    expect(screen.getByText("90° clockwise → 1280 × 720")).toBeInTheDocument();
    expect(screen.getByText("7.2 px p95 · worst index 12.4 px")).toBeInTheDocument();
    expect(
      screen.getByText("No coordinates, images, or diagnostics leave this phone."),
    ).toBeInTheDocument();
  });

  it("makes the one-player measurement boundary explicit", () => {
    render(<PoseDiagnosticsPanel diagnostics={DIAGNOSTICS} poseLimit={2} />);

    expect(screen.getAllByText("Hand spread is measured only in 1-player mode.")).toHaveLength(2);
  });
});
