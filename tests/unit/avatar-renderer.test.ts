import { describe, expect, it, vi } from "vitest";
import type { PoseLandmark } from "../../src/domain/pose";
import { AVATAR_APPEARANCES, drawAvatar, type AvatarAppearance } from "../../src/render/avatar";
import type {
  AvatarPresentationFrame,
  AvatarPresentationPose,
} from "../../src/render/avatar-presentation";

interface ContextHarness {
  context: CanvasRenderingContext2D;
  gradientStops: Array<[number, string]>;
}

function contextHarness(): ContextHarness {
  const gradientStops: Array<[number, string]> = [];
  const gradient = () =>
    ({
      addColorStop: vi.fn((offset: number, color: string) => gradientStops.push([offset, color])),
    }) as unknown as CanvasGradient;
  const context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(gradient),
    createRadialGradient: vi.fn(gradient),
    ellipse: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  return { context, gradientStops };
}

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function setVisible(landmarks: PoseLandmark[], index: number, x: number, y: number, z = 0): void {
  const target = landmarks[index];
  if (target === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  Object.assign(target, { x, y, z, visibility: 1 });
}

function completeAvatarPose(sourcePoseIndex = 0, offsetX = 0): AvatarPresentationPose {
  const landmarks = Array.from({ length: 33 }, hiddenLandmark);
  const visible = (index: number, x: number, y: number, z = 0) =>
    setVisible(landmarks, index, x + offsetX, y, z);

  visible(0, 0.5, 0.15);
  visible(1, 0.48, 0.145);
  visible(2, 0.47, 0.145);
  visible(3, 0.455, 0.15);
  visible(4, 0.52, 0.145);
  visible(5, 0.53, 0.145);
  visible(6, 0.545, 0.15);
  visible(7, 0.44, 0.17);
  visible(8, 0.56, 0.17);
  visible(9, 0.48, 0.19);
  visible(10, 0.52, 0.19);
  visible(11, 0.4, 0.3, -0.04);
  visible(12, 0.6, 0.3, 0);
  visible(13, 0.34, 0.47, -0.04);
  visible(14, 0.66, 0.47, 0);
  visible(15, 0.3, 0.62, -0.04);
  visible(16, 0.7, 0.62, 0);
  visible(17, 0.28, 0.64, -0.04);
  visible(18, 0.72, 0.64, 0);
  visible(19, 0.3, 0.66, -0.04);
  visible(20, 0.7, 0.66, 0);
  visible(21, 0.32, 0.64, -0.04);
  visible(22, 0.68, 0.64, 0);
  visible(23, 0.44, 0.58, -0.04);
  visible(24, 0.56, 0.58, 0);
  visible(25, 0.43, 0.76, -0.04);
  visible(26, 0.57, 0.76, 0);
  visible(27, 0.42, 0.91, -0.04);
  visible(28, 0.58, 0.91, 0);
  visible(29, 0.4, 0.94, -0.04);
  visible(30, 0.6, 0.94, 0);
  visible(31, 0.46, 0.95, -0.04);
  visible(32, 0.54, 0.95, 0);
  return { sourcePoseIndex, nearSide: "left", landmarks };
}

function frame(...poses: AvatarPresentationPose[]): AvatarPresentationFrame {
  return {
    sequence: 1,
    capturedAtMs: 0,
    frame: { width: 1_000, height: 1_000 },
    poses,
  };
}

describe("Avatar renderer", () => {
  it("draws a complete faceless procedural body with rounded layered primitives", () => {
    const { context, gradientStops } = contextHarness();

    drawAvatar(context, frame(completeAvatarPose()), 1_000, 1_000, {
      mirrored: false,
      appearance: "stage",
    });

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1_000, 1_000);
    expect(context.globalAlpha).toBe(AVATAR_APPEARANCES.stage.opacity);
    expect(context.quadraticCurveTo).toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalledTimes(4);
    expect(context.ellipse).toHaveBeenCalledTimes(5);
    expect(context.createLinearGradient).toHaveBeenCalled();
    expect(context.createRadialGradient).toHaveBeenCalled();
    expect(gradientStops).toContainEqual([0.72, "#5eead4"]);

    const pathStarts = vi.mocked(context.moveTo).mock.calls;
    const torsoIndex = pathStarts.findIndex(([x, y]) => x === 400 && y === 300);
    expect(torsoIndex).toBeGreaterThan(0);
    expect(torsoIndex).toBeLessThan(pathStarts.length - 1);
    expect(vi.mocked(context.ellipse).mock.calls[2]?.slice(0, 2)).toEqual([500, 167.5]);
  });

  it("omits a pose without a complete torso and omits unavailable optional anatomy", () => {
    const missingTorso = completeAvatarPose();
    const rightHip = missingTorso.landmarks[24];
    if (rightHip === undefined) {
      throw new Error("Missing right hip.");
    }
    rightHip.visibility = 0;
    const torsoHarness = contextHarness();
    drawAvatar(torsoHarness.context, frame(missingTorso), 1_000, 1_000, {
      mirrored: false,
      appearance: "stage",
    });
    expect(torsoHarness.context.fill).not.toHaveBeenCalled();

    const torsoOnly = completeAvatarPose();
    for (const [index, landmark] of torsoOnly.landmarks.entries()) {
      if (![11, 12, 23, 24].includes(index)) {
        landmark.visibility = 0;
      }
    }
    const partialHarness = contextHarness();
    drawAvatar(partialHarness.context, frame(torsoOnly), 1_000, 1_000, {
      mirrored: false,
      appearance: "stage",
    });
    expect(partialHarness.context.fill).toHaveBeenCalledTimes(1);
    expect(partialHarness.context.arc).not.toHaveBeenCalled();
    expect(partialHarness.context.ellipse).not.toHaveBeenCalled();
  });

  it("uses the common projection mirror and the selected appearance opacity", () => {
    for (const [appearance, { opacity }] of Object.entries(AVATAR_APPEARANCES) as Array<
      [AvatarAppearance, { opacity: number }]
    >) {
      const pose = completeAvatarPose();
      for (const [index, landmark] of pose.landmarks.entries()) {
        if (![11, 12, 23, 24].includes(index)) {
          landmark.visibility = 0;
        }
      }
      const unmirrored = contextHarness();
      drawAvatar(unmirrored.context, frame(pose), 1_000, 1_000, {
        mirrored: false,
        appearance,
      });
      const mirrored = contextHarness();
      drawAvatar(mirrored.context, frame(pose), 1_000, 1_000, {
        mirrored: true,
        appearance,
      });

      expect(unmirrored.context.globalAlpha).toBe(opacity);
      expect(mirrored.context.globalAlpha).toBe(opacity);
      expect(unmirrored.context.moveTo).toHaveBeenCalledWith(400, 300);
      expect(mirrored.context.moveTo).toHaveBeenCalledWith(600, 300);
    }
  });

  it("selects the rose material for the second current pose without treating it as identity", () => {
    const { context, gradientStops } = contextHarness();

    drawAvatar(
      context,
      frame(completeAvatarPose(0, -0.2), completeAvatarPose(1, 0.2)),
      1_000,
      1_000,
      { mirrored: true, appearance: "bubbles" },
    );

    expect(gradientStops).toContainEqual([0.72, "#5eead4"]);
    expect(gradientStops).toContainEqual([0.72, "#fb7185"]);
  });

  it("clears without drawing when no presentation frame is available", () => {
    const { context } = contextHarness();

    drawAvatar(context, null, 640, 360, { mirrored: false, appearance: "camera" });

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(context.fill).not.toHaveBeenCalled();
  });
});
