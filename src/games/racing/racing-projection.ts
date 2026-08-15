import type { Size } from "../../render/geometry";
import type { RacingCarSnapshot } from "./racing-session";
import {
  RACING_ROAD_HALF_WIDTH,
  RACING_TRACK,
  type RacingTrack,
  type RacingTrackPoint,
  racingTrackPointAt,
} from "./racing-track";

export interface ProjectedRoadPoint {
  centerX: number;
  y: number;
  roadHalfWidth: number;
  depth: number;
  scale: number;
}

export interface ProjectedRoadSlice {
  segmentIndex: number;
  near: ProjectedRoadPoint;
  far: ProjectedRoadPoint;
  finish: boolean;
  alternating: boolean;
}

export interface ProjectedTrackObject {
  x: number;
  y: number;
  scale: number;
  depth: number;
  visible: boolean;
}

export interface RacingRoadProjection {
  horizonY: number;
  slices: readonly ProjectedRoadSlice[];
}

interface CameraBasis {
  point: RacingTrackPoint;
  x: number;
  z: number;
  elevation: number;
  sinHeading: number;
  cosHeading: number;
  focalLength: number;
  horizonY: number;
}

const CAMERA_TRAILING_DISTANCE = 7;
const CAMERA_HEIGHT = 2.7;
const DRAW_DISTANCE_SEGMENTS = 115;
const NEAR_CLIP = 1.5;

function cameraBasis(
  track: RacingTrack,
  car: Pick<RacingCarSnapshot, "distance" | "lateral">,
  viewport: Size,
): CameraBasis {
  const cameraDistance = Math.max(0, car.distance - CAMERA_TRAILING_DISTANCE);
  const point = racingTrackPointAt(track, cameraDistance);
  const sinHeading = Math.sin(point.heading);
  const cosHeading = Math.cos(point.heading);
  const lateralWorld = car.lateral * RACING_ROAD_HALF_WIDTH;
  return {
    point,
    x: point.x + cosHeading * lateralWorld,
    z: point.z - sinHeading * lateralWorld,
    elevation: point.elevation + CAMERA_HEIGHT,
    sinHeading,
    cosHeading,
    focalLength: viewport.height * 0.92,
    horizonY: viewport.height * 0.34,
  };
}

function projectPoint(
  point: RacingTrackPoint,
  lateralWorld: number,
  camera: CameraBasis,
  viewport: Size,
): ProjectedRoadPoint | null {
  const pointSin = Math.sin(point.heading);
  const pointCos = Math.cos(point.heading);
  const worldX = point.x + pointCos * lateralWorld;
  const worldZ = point.z - pointSin * lateralWorld;
  const deltaX = worldX - camera.x;
  const deltaZ = worldZ - camera.z;
  const localX = deltaX * camera.cosHeading - deltaZ * camera.sinHeading;
  const depth = deltaX * camera.sinHeading + deltaZ * camera.cosHeading;
  if (depth < NEAR_CLIP) {
    return null;
  }
  const scale = camera.focalLength / depth;
  return {
    centerX: viewport.width / 2 + localX * scale,
    y: camera.horizonY + (camera.elevation - point.elevation) * scale,
    roadHalfWidth: RACING_ROAD_HALF_WIDTH * scale,
    depth,
    scale,
  };
}

function projectRoadCenter(
  point: RacingTrackPoint,
  camera: CameraBasis,
  viewport: Size,
): ProjectedRoadPoint | null {
  return projectPoint(point, 0, camera, viewport);
}

export function projectRacingRoad(
  car: Pick<RacingCarSnapshot, "distance" | "lateral">,
  viewport: Size,
  track: RacingTrack = RACING_TRACK,
): RacingRoadProjection {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new Error("Racing projection requires a positive viewport.");
  }
  const camera = cameraBasis(track, car, viewport);
  const firstBoundaryIndex = Math.max(1, Math.ceil(camera.point.distance / track.segmentLength));
  const lastBoundaryIndex = Math.min(
    track.points.length - 1,
    firstBoundaryIndex + DRAW_DISTANCE_SEGMENTS,
  );
  const projected: Array<{ point: ProjectedRoadPoint; boundaryIndex: number }> = [];
  for (
    let boundaryIndex = firstBoundaryIndex;
    boundaryIndex <= lastBoundaryIndex;
    boundaryIndex += 1
  ) {
    const trackPoint = track.points[boundaryIndex];
    if (trackPoint === undefined) {
      continue;
    }
    const point = projectRoadCenter(trackPoint, camera, viewport);
    if (point !== null) {
      projected.push({ point, boundaryIndex });
    }
  }

  const slices: ProjectedRoadSlice[] = [];
  for (let index = 0; index < projected.length - 1; index += 1) {
    const near = projected[index];
    const far = projected[index + 1];
    if (near === undefined || far === undefined || far.point.depth <= near.point.depth) {
      continue;
    }
    const segmentIndex = near.boundaryIndex;
    slices.push({
      segmentIndex,
      near: near.point,
      far: far.point,
      finish: segmentIndex === track.points.length - 2,
      alternating: Math.floor(segmentIndex / 3) % 2 === 0,
    });
  }
  return { horizonY: camera.horizonY, slices };
}

export function projectRacingObject(
  cameraCar: Pick<RacingCarSnapshot, "distance" | "lateral">,
  objectDistance: number,
  objectLateral: number,
  viewport: Size,
  track: RacingTrack = RACING_TRACK,
): ProjectedTrackObject {
  const camera = cameraBasis(track, cameraCar, viewport);
  const point = racingTrackPointAt(track, objectDistance);
  const projected = projectPoint(point, objectLateral * RACING_ROAD_HALF_WIDTH, camera, viewport);
  if (projected === null) {
    return { x: 0, y: 0, scale: 0, depth: 0, visible: false };
  }
  const visible =
    projected.depth <= DRAW_DISTANCE_SEGMENTS * track.segmentLength &&
    projected.centerX >= -viewport.width * 0.25 &&
    projected.centerX <= viewport.width * 1.25 &&
    projected.y >= camera.horizonY - viewport.height * 0.1 &&
    projected.y <= viewport.height * 1.25;
  return {
    x: projected.centerX,
    y: projected.y,
    scale: projected.scale,
    depth: projected.depth,
    visible,
  };
}
