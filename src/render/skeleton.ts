import type { PosePacket } from "../domain/pose";
import { calculateContainTransform, mapNormalizedPoint } from "./geometry";

export const LANDMARK_VISIBILITY_THRESHOLD = 0.35;

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

const POSE_COLORS: readonly [string, string] = ["#5eead4", "#fb7185"];

export function drawSkeleton(
  context: CanvasRenderingContext2D,
  packet: PosePacket | null,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  if (packet === null) {
    return;
  }

  const transform = calculateContainTransform(
    packet.frame.width,
    packet.frame.height,
    width,
    height,
  );
  const lineWidth = Math.max(3, Math.min(width, height) * 0.006);
  const landmarkRadius = lineWidth * 0.82;

  for (const [poseIndex, pose] of packet.poses.entries()) {
    const color = POSE_COLORS[poseIndex] ?? POSE_COLORS[0];
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
        from.visibility < LANDMARK_VISIBILITY_THRESHOLD ||
        to.visibility < LANDMARK_VISIBILITY_THRESHOLD
      ) {
        continue;
      }
      const start = mapNormalizedPoint(
        from.x,
        from.y,
        packet.frame.width,
        packet.frame.height,
        transform,
      );
      const end = mapNormalizedPoint(
        to.x,
        to.y,
        packet.frame.width,
        packet.frame.height,
        transform,
      );
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }

    for (const landmark of pose.landmarks) {
      if (landmark.visibility < LANDMARK_VISIBILITY_THRESHOLD) {
        continue;
      }
      const point = mapNormalizedPoint(
        landmark.x,
        landmark.y,
        packet.frame.width,
        packet.frame.height,
        transform,
      );
      context.beginPath();
      context.arc(point.x, point.y, landmarkRadius, 0, Math.PI * 2);
      context.fill();
    }
  }
}
