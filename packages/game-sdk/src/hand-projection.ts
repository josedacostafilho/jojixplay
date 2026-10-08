import type { HandPoint } from "./index";

/** Mirrored camera coordinates, fitting the complete hand inside viewport margins. */
export function projectHandLandmarks(landmarks: readonly HandPoint[]): HandPoint[] {
  if (!landmarks.length) return [];
  const points = landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(1, 0.92 / (maxX - minX), 0.92 / (maxY - minY));
  const edgeOffset = (low: number, high: number) =>
    Math.max(0.04 - low * scale, Math.min(0, 0.96 - high * scale));
  const dx = edgeOffset(minX, maxX),
    dy = edgeOffset(minY, maxY);
  return points.map((p) => ({ x: p.x * scale + dx, y: p.y * scale + dy, z: p.z }));
}
