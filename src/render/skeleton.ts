import { type PosePacket, USABLE_LANDMARK_VISIBILITY } from "../domain/pose";
import { createPoseProjection, projectNormalizedPoint, type Size } from "./geometry";

export const SKELETON_PALETTES = [
  ["#5eead4", "#fb7185"],
  ["#fbbf24", "#a78bfa"],
] as const;

export type SkeletonPalette = (typeof SKELETON_PALETTES)[number];

export interface CircleBurst {
  createdAtMs: number;
  frame: Size;
  circles: ReadonlyArray<{
    x: number;
    y: number;
    radius: number;
    colorIndex: 0 | 1;
  }>;
}

export const CIRCLE_BURST_DURATION_MS = 3_000;

export interface SkeletonRenderOptions {
  mirrored: boolean;
  palette: SkeletonPalette;
  circleBurst: CircleBurst | null;
  nowMs: number;
}

const CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
  [27, 31],
  [28, 32],
];

export function drawSkeleton(
  context: CanvasRenderingContext2D,
  packet: PosePacket | null,
  width: number,
  height: number,
  options: SkeletonRenderOptions,
): void {
  context.clearRect(0, 0, width, height);

  if (options.circleBurst !== null) {
    const ageMs = options.nowMs - options.circleBurst.createdAtMs;
    if (ageMs >= 0 && ageMs < CIRCLE_BURST_DURATION_MS) {
      const opacity = 1 - ageMs / CIRCLE_BURST_DURATION_MS;
      const minimumDimension = Math.min(width, height);
      context.save();
      context.globalAlpha = opacity;
      context.lineWidth = Math.max(3, minimumDimension * 0.006);
      const projection = createPoseProjection(
        options.circleBurst.frame.width,
        options.circleBurst.frame.height,
        width,
        height,
        options.mirrored,
      );
      const projectedMinimumFrameDimension =
        Math.min(options.circleBurst.frame.width, options.circleBurst.frame.height) *
        projection.scale;
      for (const circle of options.circleBurst.circles) {
        const center = projectNormalizedPoint(circle.x, circle.y, projection);
        context.strokeStyle = options.palette[circle.colorIndex];
        context.beginPath();
        context.arc(
          center.x,
          center.y,
          circle.radius * projectedMinimumFrameDimension,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      context.restore();
    }
  }

  if (packet === null) {
    return;
  }

  const projection = createPoseProjection(
    packet.frame.width,
    packet.frame.height,
    width,
    height,
    options.mirrored,
  );
  const lineWidth = Math.max(3, Math.min(width, height) * 0.006);
  const landmarkRadius = lineWidth * 0.82;

  for (const [poseIndex, pose] of packet.poses.entries()) {
    const color = options.palette[poseIndex] ?? options.palette[0];
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    for (const [fromIndex, toIndex] of CONNECTIONS) {
      const from = pose.landmarks[fromIndex];
      const to = pose.landmarks[toIndex];
      if (
        from === undefined ||
        to === undefined ||
        from.visibility < USABLE_LANDMARK_VISIBILITY ||
        to.visibility < USABLE_LANDMARK_VISIBILITY
      ) {
        continue;
      }
      const start = projectNormalizedPoint(from.x, from.y, projection);
      const end = projectNormalizedPoint(to.x, to.y, projection);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }

    for (const landmark of pose.landmarks) {
      if (landmark.visibility < USABLE_LANDMARK_VISIBILITY) {
        continue;
      }
      const point = projectNormalizedPoint(landmark.x, landmark.y, projection);
      context.beginPath();
      context.arc(point.x, point.y, landmarkRadius, 0, Math.PI * 2);
      context.fill();
    }
  }
}
