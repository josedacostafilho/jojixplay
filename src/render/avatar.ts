import { coarseHand, usablePoseLandmark, type PoseHand } from "../domain/pose-features";
import type { AvatarPresentationFrame, AvatarPresentationPose } from "./avatar-presentation";
import {
  createPoseProjection,
  type Point,
  type PoseProjection,
  projectNormalizedPoint,
} from "./geometry";

export const AVATAR_ACCENT_PALETTE = ["#5eead4", "#fb7185"] as const;

export const AVATAR_APPEARANCES = {
  stage: { opacity: 0.94 },
  draw: { opacity: 0.24 },
  bubbles: { opacity: 0.16 },
  camera: { opacity: 0.38 },
} as const;

export type AvatarAppearance = keyof typeof AVATAR_APPEARANCES;

export interface AvatarRenderOptions {
  mirrored: boolean;
  appearance: AvatarAppearance;
}

interface AvatarMaterial {
  accent: string;
  base: string;
  dark: string;
  light: string;
  rim: string;
  highlight: string;
  glow: string;
}

interface HeadGeometry {
  center: Point;
  radiusX: number;
  radiusY: number;
}

interface BodyGeometry {
  bodyScale: number;
  leftShoulder: Point;
  rightShoulder: Point;
  leftHip: Point;
  rightHip: Point;
  shoulderCenter: Point;
  hipCenter: Point;
  head: HeadGeometry | null;
}

const AVATAR_MATERIALS: readonly AvatarMaterial[] = [
  {
    accent: AVATAR_ACCENT_PALETTE[0],
    base: "#0f766e",
    dark: "#042f2e",
    light: "#99f6e4",
    rim: "#ccfbf1",
    highlight: "rgb(204 251 241 / 38%)",
    glow: "rgb(94 234 212 / 24%)",
  },
  {
    accent: AVATAR_ACCENT_PALETTE[1],
    base: "#be123c",
    dark: "#4c0519",
    light: "#fecdd3",
    rim: "#ffe4e6",
    highlight: "rgb(255 228 230 / 38%)",
    glow: "rgb(251 113 133 / 24%)",
  },
];

const FACE_LANDMARK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const SIDE_LANDMARKS = {
  left: {
    shoulder: 11,
    elbow: 13,
    wrist: 15,
    hip: 23,
    knee: 25,
    ankle: 27,
    heel: 29,
    footIndex: 31,
  },
  right: {
    shoulder: 12,
    elbow: 14,
    wrist: 16,
    hip: 24,
    knee: 26,
    ankle: 28,
    heel: 30,
    footIndex: 32,
  },
} as const satisfies Record<PoseHand, Record<string, number>>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function projectedLandmark(
  pose: AvatarPresentationPose,
  index: number,
  projection: PoseProjection,
): Point | null {
  const landmark = usablePoseLandmark(pose, index);
  return landmark === null ? null : projectNormalizedPoint(landmark.x, landmark.y, projection);
}

function materialForPose(pose: AvatarPresentationPose): AvatarMaterial {
  const material = AVATAR_MATERIALS[pose.sourcePoseIndex] ?? AVATAR_MATERIALS[0];
  if (material === undefined) {
    throw new Error("Avatar material palette is empty.");
  }
  return material;
}

function addBodyGradientStops(gradient: CanvasGradient, material: AvatarMaterial): void {
  gradient.addColorStop(0, material.dark);
  gradient.addColorStop(0.42, material.base);
  gradient.addColorStop(0.72, material.accent);
  gradient.addColorStop(1, material.light);
}

function applyRim(
  context: CanvasRenderingContext2D,
  material: AvatarMaterial,
  scale: number,
): void {
  context.strokeStyle = material.rim;
  context.lineWidth = clamp(scale * 0.008, 1, 3.5);
  context.stroke();
}

function drawTaperedSegment(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  startWidth: number,
  endWidth: number,
  material: AvatarMaterial,
  bodyScale: number,
): void {
  const length = distance(start, end);
  if (length < 0.5) {
    return;
  }
  const unitX = (end.x - start.x) / length;
  const unitY = (end.y - start.y) / length;
  const normalX = -unitY;
  const normalY = unitX;
  const startRadius = startWidth / 2;
  const endRadius = endWidth / 2;

  const gradient = context.createLinearGradient(
    start.x + normalX * startRadius,
    start.y + normalY * startRadius,
    start.x - normalX * startRadius,
    start.y - normalY * startRadius,
  );
  addBodyGradientStops(gradient, material);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(start.x + normalX * startRadius, start.y + normalY * startRadius);
  context.lineTo(end.x + normalX * endRadius, end.y + normalY * endRadius);
  context.quadraticCurveTo(
    end.x + unitX * endRadius * 0.72,
    end.y + unitY * endRadius * 0.72,
    end.x - normalX * endRadius,
    end.y - normalY * endRadius,
  );
  context.lineTo(start.x - normalX * startRadius, start.y - normalY * startRadius);
  context.quadraticCurveTo(
    start.x - unitX * startRadius * 0.72,
    start.y - unitY * startRadius * 0.72,
    start.x + normalX * startRadius,
    start.y + normalY * startRadius,
  );
  context.closePath();
  context.fill();
  applyRim(context, material, bodyScale);
}

function drawJoint(
  context: CanvasRenderingContext2D,
  point: Point,
  radius: number,
  material: AvatarMaterial,
  bodyScale: number,
): void {
  const gradient = context.createRadialGradient(
    point.x - radius * 0.28,
    point.y - radius * 0.32,
    radius * 0.08,
    point.x,
    point.y,
    radius,
  );
  gradient.addColorStop(0, material.light);
  gradient.addColorStop(0.5, material.accent);
  gradient.addColorStop(1, material.dark);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  applyRim(context, material, bodyScale);
}

function drawMaterialEllipse(
  context: CanvasRenderingContext2D,
  center: Point,
  radiusX: number,
  radiusY: number,
  rotation: number,
  material: AvatarMaterial,
  bodyScale: number,
): void {
  const gradientRadius = Math.max(radiusX, radiusY);
  const gradient = context.createRadialGradient(
    center.x - radiusX * 0.26,
    center.y - radiusY * 0.3,
    gradientRadius * 0.06,
    center.x,
    center.y,
    gradientRadius,
  );
  gradient.addColorStop(0, material.light);
  gradient.addColorStop(0.46, material.accent);
  gradient.addColorStop(1, material.dark);
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(center.x, center.y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  context.fill();
  applyRim(context, material, bodyScale);
}

function headGeometry(
  pose: AvatarPresentationPose,
  projection: PoseProjection,
  bodyScale: number,
): HeadGeometry | null {
  if (usablePoseLandmark(pose, 0) === null) {
    return null;
  }
  const points = FACE_LANDMARK_INDICES.flatMap((index) => {
    const point = projectedLandmark(pose, index, projection);
    return point === null ? [] : [point];
  });
  if (points.length < 3) {
    return null;
  }

  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  const radiusX = clamp(
    Math.max((maximumX - minimumX) * 0.7, bodyScale * 0.15),
    bodyScale * 0.14,
    bodyScale * 0.25,
  );
  const radiusY = clamp(
    Math.max((maximumY - minimumY) * 0.9, radiusX * 1.12),
    radiusX * 1.08,
    radiusX * 1.32,
  );
  return {
    center: { x: (minimumX + maximumX) / 2, y: (minimumY + maximumY) / 2 },
    radiusX,
    radiusY,
  };
}

function bodyGeometry(
  pose: AvatarPresentationPose,
  projection: PoseProjection,
  viewportMinimum: number,
): BodyGeometry | null {
  const leftShoulder = projectedLandmark(pose, 11, projection);
  const rightShoulder = projectedLandmark(pose, 12, projection);
  const leftHip = projectedLandmark(pose, 23, projection);
  const rightHip = projectedLandmark(pose, 24, projection);
  if (leftShoulder === null || rightShoulder === null || leftHip === null || rightHip === null) {
    return null;
  }
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const torsoLength = distance(shoulderCenter, hipCenter);
  const torsoWidth = (distance(leftShoulder, rightShoulder) + distance(leftHip, rightHip)) / 2;
  const bodyScale = clamp(
    torsoLength * 0.62 + torsoWidth * 0.38,
    viewportMinimum * 0.09,
    viewportMinimum * 0.42,
  );
  return {
    bodyScale,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    shoulderCenter,
    hipCenter,
    head: headGeometry(pose, projection, bodyScale),
  };
}

function drawTorso(
  context: CanvasRenderingContext2D,
  geometry: BodyGeometry,
  material: AvatarMaterial,
): void {
  const { leftShoulder, rightShoulder, leftHip, rightHip, bodyScale } = geometry;
  const bodyXs = [leftShoulder.x, rightShoulder.x, leftHip.x, rightHip.x];
  const gradient = context.createLinearGradient(Math.min(...bodyXs), 0, Math.max(...bodyXs), 0);
  addBodyGradientStops(gradient, material);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(leftShoulder.x, leftShoulder.y);
  context.quadraticCurveTo(
    geometry.shoulderCenter.x,
    geometry.shoulderCenter.y - bodyScale * 0.035,
    rightShoulder.x,
    rightShoulder.y,
  );
  context.quadraticCurveTo(
    rightHip.x + (rightShoulder.x - rightHip.x) * 0.18,
    (rightShoulder.y + rightHip.y) / 2,
    rightHip.x,
    rightHip.y,
  );
  context.quadraticCurveTo(
    geometry.hipCenter.x,
    geometry.hipCenter.y + bodyScale * 0.025,
    leftHip.x,
    leftHip.y,
  );
  context.quadraticCurveTo(
    leftHip.x + (leftShoulder.x - leftHip.x) * 0.18,
    (leftShoulder.y + leftHip.y) / 2,
    leftShoulder.x,
    leftShoulder.y,
  );
  context.closePath();
  context.fill();
  applyRim(context, material, bodyScale);

  context.strokeStyle = material.highlight;
  context.lineWidth = clamp(bodyScale * 0.018, 1.5, 6);
  context.beginPath();
  context.moveTo(
    geometry.shoulderCenter.x - bodyScale * 0.075,
    geometry.shoulderCenter.y + bodyScale * 0.04,
  );
  context.quadraticCurveTo(
    geometry.shoulderCenter.x - bodyScale * 0.04,
    (geometry.shoulderCenter.y + geometry.hipCenter.y) / 2,
    geometry.hipCenter.x - bodyScale * 0.035,
    geometry.hipCenter.y - bodyScale * 0.045,
  );
  context.stroke();
}

function drawNeck(
  context: CanvasRenderingContext2D,
  geometry: BodyGeometry,
  material: AvatarMaterial,
): void {
  const head = geometry.head;
  if (head === null) {
    return;
  }
  const neckEnd = {
    x: head.center.x,
    y: head.center.y + head.radiusY * 0.78,
  };
  drawTaperedSegment(
    context,
    geometry.shoulderCenter,
    neckEnd,
    geometry.bodyScale * 0.16,
    geometry.bodyScale * 0.13,
    material,
    geometry.bodyScale,
  );
}

function drawHead(
  context: CanvasRenderingContext2D,
  geometry: BodyGeometry,
  material: AvatarMaterial,
): void {
  const head = geometry.head;
  if (head === null) {
    return;
  }
  drawMaterialEllipse(
    context,
    head.center,
    head.radiusX,
    head.radiusY,
    0,
    material,
    geometry.bodyScale,
  );
}

function drawArm(
  context: CanvasRenderingContext2D,
  pose: AvatarPresentationPose,
  side: PoseHand,
  projection: PoseProjection,
  geometry: BodyGeometry,
  material: AvatarMaterial,
): void {
  const indices = SIDE_LANDMARKS[side];
  const shoulder = projectedLandmark(pose, indices.shoulder, projection);
  const elbow = projectedLandmark(pose, indices.elbow, projection);
  const wrist = projectedLandmark(pose, indices.wrist, projection);
  const scale = geometry.bodyScale;
  if (shoulder !== null && elbow !== null) {
    drawTaperedSegment(context, shoulder, elbow, scale * 0.14, scale * 0.11, material, scale);
  }
  if (elbow !== null && wrist !== null) {
    drawTaperedSegment(context, elbow, wrist, scale * 0.11, scale * 0.075, material, scale);
  }
  if (elbow !== null && (shoulder !== null || wrist !== null)) {
    drawJoint(context, elbow, scale * 0.06, material, scale);
  }

  const hand = coarseHand(pose, side);
  if (hand === null || wrist === null) {
    return;
  }
  const center = projectNormalizedPoint(hand.center.x, hand.center.y, projection);
  const handPoints = Object.values(hand.landmarks).map((landmark) =>
    projectNormalizedPoint(landmark.x, landmark.y, projection),
  );
  const spread = Math.max(...handPoints.map((point) => distance(point, center)));
  const radiusX = clamp(
    Math.max(distance(wrist, center) * 1.35, spread * 1.08),
    scale * 0.055,
    scale * 0.12,
  );
  const radiusY = clamp(radiusX * 0.68, scale * 0.042, scale * 0.082);
  drawMaterialEllipse(
    context,
    center,
    radiusX,
    radiusY,
    Math.atan2(center.y - wrist.y, center.x - wrist.x),
    material,
    scale,
  );
}

function drawLeg(
  context: CanvasRenderingContext2D,
  pose: AvatarPresentationPose,
  side: PoseHand,
  projection: PoseProjection,
  geometry: BodyGeometry,
  material: AvatarMaterial,
): void {
  const indices = SIDE_LANDMARKS[side];
  const hip = projectedLandmark(pose, indices.hip, projection);
  const knee = projectedLandmark(pose, indices.knee, projection);
  const ankle = projectedLandmark(pose, indices.ankle, projection);
  const scale = geometry.bodyScale;
  if (hip !== null && knee !== null) {
    drawTaperedSegment(context, hip, knee, scale * 0.18, scale * 0.14, material, scale);
  }
  if (knee !== null && ankle !== null) {
    drawTaperedSegment(context, knee, ankle, scale * 0.14, scale * 0.09, material, scale);
  }
  if (knee !== null && (hip !== null || ankle !== null)) {
    drawJoint(context, knee, scale * 0.075, material, scale);
  }

  const heel = projectedLandmark(pose, indices.heel, projection);
  const footIndex = projectedLandmark(pose, indices.footIndex, projection);
  if (ankle === null || heel === null || footIndex === null) {
    return;
  }
  const center = midpoint(heel, footIndex);
  const footLength = distance(heel, footIndex);
  const radiusX = clamp(footLength * 0.64, scale * 0.08, scale * 0.2);
  const radiusY = clamp(radiusX * 0.42, scale * 0.045, scale * 0.075);
  drawMaterialEllipse(
    context,
    center,
    radiusX,
    radiusY,
    Math.atan2(footIndex.y - heel.y, footIndex.x - heel.x),
    material,
    scale,
  );
}

function drawSide(
  context: CanvasRenderingContext2D,
  pose: AvatarPresentationPose,
  side: PoseHand,
  projection: PoseProjection,
  geometry: BodyGeometry,
  material: AvatarMaterial,
): void {
  drawLeg(context, pose, side, projection, geometry, material);
  drawArm(context, pose, side, projection, geometry, material);
}

function drawPose(
  context: CanvasRenderingContext2D,
  pose: AvatarPresentationPose,
  projection: PoseProjection,
  viewportMinimum: number,
): void {
  const geometry = bodyGeometry(pose, projection, viewportMinimum);
  if (geometry === null) {
    return;
  }
  const material = materialForPose(pose);
  const farSide: PoseHand = pose.nearSide === "left" ? "right" : "left";
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = material.glow;
  context.shadowBlur = clamp(geometry.bodyScale * 0.045, 2, 14);
  drawSide(context, pose, farSide, projection, geometry, material);
  drawNeck(context, geometry, material);
  drawTorso(context, geometry, material);
  drawHead(context, geometry, material);
  drawSide(context, pose, pose.nearSide, projection, geometry, material);
  context.restore();
}

export function drawAvatar(
  context: CanvasRenderingContext2D,
  frame: AvatarPresentationFrame | null,
  width: number,
  height: number,
  options: AvatarRenderOptions,
): void {
  context.clearRect(0, 0, width, height);
  if (frame === null || width <= 0 || height <= 0) {
    return;
  }

  const projection = createPoseProjection(
    frame.frame.width,
    frame.frame.height,
    width,
    height,
    options.mirrored,
  );
  context.save();
  context.globalAlpha = AVATAR_APPEARANCES[options.appearance].opacity;
  for (const pose of frame.poses) {
    drawPose(context, pose, projection, Math.min(width, height));
  }
  context.restore();
}
