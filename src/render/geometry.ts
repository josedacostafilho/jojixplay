export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rectangle extends Point, Size {}

export interface PoseProjection {
  source: Size;
  mirrored: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function createPoseProjection(
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  mirrored: boolean,
): PoseProjection {
  const scale = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  return {
    source: { width: sourceWidth, height: sourceHeight },
    mirrored,
    scale,
    offsetX: (viewportWidth - sourceWidth * scale) / 2,
    offsetY: (viewportHeight - sourceHeight * scale) / 2,
  };
}

export function projectNormalizedPoint(x: number, y: number, projection: PoseProjection): Point {
  const projectedX = projection.mirrored ? 1 - x : x;
  return {
    x: projection.offsetX + projectedX * projection.source.width * projection.scale,
    y: projection.offsetY + y * projection.source.height * projection.scale,
  };
}

export function projectedFrameBounds(projection: PoseProjection): Rectangle {
  return {
    x: projection.offsetX,
    y: projection.offsetY,
    width: projection.source.width * projection.scale,
    height: projection.source.height * projection.scale,
  };
}
