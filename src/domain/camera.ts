export const CAMERA_FRAME_MAX_DIMENSION = 16_384;

export type CameraLayout = "portrait" | "landscape";
export type CameraRotation = 0 | 90 | 180 | 270;

export interface CameraSize {
  width: number;
  height: number;
}

export interface CameraPoint {
  x: number;
  y: number;
}

export interface CameraFrame extends CameraSize {
  layout: CameraLayout;
  epoch: number;
}

export interface ScreenCameraOrientation {
  type: "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary";
  layout: CameraLayout;
  angle: CameraRotation;
}

export interface CameraFrameNormalization {
  source: CameraSize;
  rotation: CameraRotation;
  frame: CameraFrame;
  screen: ScreenCameraOrientation;
}

export interface CameraLayoutMessage {
  cameraLayout: CameraLayout;
}

export type CameraLayoutParseResult =
  | { ok: true; value: CameraLayoutMessage }
  | { ok: false; error: string };

export type ScreenCameraOrientationParseResult =
  | { ok: true; value: ScreenCameraOrientation }
  | { ok: false; error: string };

export function isCameraLayout(value: unknown): value is CameraLayout {
  return value === "portrait" || value === "landscape";
}

export function cameraLayoutForDimensions(width: number, height: number): CameraLayout | null {
  if (width === height) {
    return null;
  }
  return width < height ? "portrait" : "landscape";
}

export function isCameraFrameDimension(value: unknown): value is number {
  return (
    Number.isInteger(value) && Number(value) > 0 && Number(value) <= CAMERA_FRAME_MAX_DIMENSION
  );
}

export function isCameraFrameEpoch(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function isCameraFrame(value: unknown): value is CameraFrame {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const frame = value as Record<string, unknown>;
  return (
    Object.keys(frame).length === 4 &&
    Object.hasOwn(frame, "width") &&
    Object.hasOwn(frame, "height") &&
    Object.hasOwn(frame, "layout") &&
    Object.hasOwn(frame, "epoch") &&
    isCameraFrameDimension(frame.width) &&
    isCameraFrameDimension(frame.height) &&
    isCameraLayout(frame.layout) &&
    cameraLayoutForDimensions(frame.width, frame.height) === frame.layout &&
    isCameraFrameEpoch(frame.epoch)
  );
}

export function parseCameraLayoutMessage(value: unknown): CameraLayoutParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Camera-layout message has an invalid shape." };
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    !Object.hasOwn(record, "cameraLayout") ||
    !isCameraLayout(record.cameraLayout)
  ) {
    return { ok: false, error: "Camera-layout message is invalid." };
  }
  return { ok: true, value: { cameraLayout: record.cameraLayout } };
}

export function parseScreenCameraOrientation(
  type: unknown,
  angle: unknown,
): ScreenCameraOrientationParseResult {
  const layout =
    type === "portrait-primary" || type === "portrait-secondary"
      ? "portrait"
      : type === "landscape-primary" || type === "landscape-secondary"
        ? "landscape"
        : null;
  if (layout === null || (angle !== 0 && angle !== 90 && angle !== 180 && angle !== 270)) {
    return { ok: false, error: "Screen orientation is unavailable or invalid." };
  }
  return {
    ok: true,
    value: {
      type: type as ScreenCameraOrientation["type"],
      layout,
      angle,
    },
  };
}

export function resolveCameraFrameNormalization(
  sourceWidth: number,
  sourceHeight: number,
  screen: ScreenCameraOrientation,
  epoch: number,
): CameraFrameNormalization {
  if (
    !isCameraFrameDimension(sourceWidth) ||
    !isCameraFrameDimension(sourceHeight) ||
    !isCameraFrameEpoch(epoch)
  ) {
    throw new Error("Camera frame metadata is invalid.");
  }
  const sourceLayout = cameraLayoutForDimensions(sourceWidth, sourceHeight);
  if (sourceLayout === null) {
    throw new Error("Square camera frames are not supported.");
  }

  let rotation: CameraRotation = 0;
  if (sourceLayout !== screen.layout) {
    if (screen.angle !== 90 && screen.angle !== 270) {
      throw new Error("Camera pixels and screen orientation are inconsistent.");
    }
    rotation = screen.angle;
  }

  const swapsDimensions = rotation === 90 || rotation === 270;
  const width = swapsDimensions ? sourceHeight : sourceWidth;
  const height = swapsDimensions ? sourceWidth : sourceHeight;
  if (cameraLayoutForDimensions(width, height) !== screen.layout) {
    throw new Error("Camera rotation did not produce the expected layout.");
  }

  return {
    source: { width: sourceWidth, height: sourceHeight },
    rotation,
    frame: { width, height, layout: screen.layout, epoch },
    screen,
  };
}

export function rotateNormalizedPoint(point: CameraPoint, rotation: CameraRotation): CameraPoint {
  switch (rotation) {
    case 0:
      return { ...point };
    case 90:
      return { x: 1 - point.y, y: point.x };
    case 180:
      return { x: 1 - point.x, y: 1 - point.y };
    case 270:
      return { x: point.y, y: 1 - point.x };
  }
}

export function sameCameraFrameBasis(left: CameraFrame, right: CameraFrame): boolean {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.layout === right.layout &&
    left.epoch === right.epoch
  );
}

export function sameCameraFrameNormalization(
  left: CameraFrameNormalization,
  right: CameraFrameNormalization,
): boolean {
  return (
    left.source.width === right.source.width &&
    left.source.height === right.source.height &&
    left.rotation === right.rotation &&
    left.frame.width === right.frame.width &&
    left.frame.height === right.frame.height &&
    left.frame.layout === right.frame.layout
  );
}
