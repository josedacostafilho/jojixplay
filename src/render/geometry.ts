export interface ContainTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function calculateContainTransform(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): ContainTransform {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    scale,
    offsetX: (targetWidth - sourceWidth * scale) / 2,
    offsetY: (targetHeight - sourceHeight * scale) / 2,
  };
}

export function mapNormalizedPoint(
  x: number,
  y: number,
  sourceWidth: number,
  sourceHeight: number,
  transform: ContainTransform,
): { x: number; y: number } {
  return {
    x: transform.offsetX + x * sourceWidth * transform.scale,
    y: transform.offsetY + y * sourceHeight * transform.scale,
  };
}
