export const RACING_TRACK_SEGMENT_LENGTH = 12;
export const RACING_ROAD_HALF_WIDTH = 5;

interface RacingTrackSection {
  segments: number;
  targetCurve: number;
  elevationDelta: number;
}

export interface RacingTrackPoint {
  distance: number;
  x: number;
  z: number;
  elevation: number;
  heading: number;
  curve: number;
}

export interface RacingTrack {
  points: readonly RacingTrackPoint[];
  segmentLength: number;
  length: number;
}

const TRACK_SECTIONS = [
  { segments: 14, targetCurve: 0, elevationDelta: 0 },
  { segments: 18, targetCurve: 0.0013, elevationDelta: 5 },
  { segments: 16, targetCurve: 0.00245, elevationDelta: 7 },
  { segments: 10, targetCurve: 0.00245, elevationDelta: -4 },
  { segments: 12, targetCurve: 0, elevationDelta: -6 },
  { segments: 22, targetCurve: -0.00165, elevationDelta: 6 },
  { segments: 14, targetCurve: -0.00255, elevationDelta: 8 },
  { segments: 12, targetCurve: 0, elevationDelta: -5 },
  { segments: 15, targetCurve: 0.0022, elevationDelta: -6 },
  { segments: 18, targetCurve: -0.00235, elevationDelta: 3 },
  { segments: 10, targetCurve: 0, elevationDelta: 4 },
  { segments: 24, targetCurve: 0.00145, elevationDelta: 12 },
  { segments: 12, targetCurve: 0.00265, elevationDelta: -4 },
  { segments: 12, targetCurve: 0, elevationDelta: -8 },
  { segments: 20, targetCurve: -0.00185, elevationDelta: -8 },
  { segments: 10, targetCurve: -0.00185, elevationDelta: 2 },
  { segments: 14, targetCurve: 0.00245, elevationDelta: 5 },
  { segments: 14, targetCurve: -0.00245, elevationDelta: -5 },
  { segments: 20, targetCurve: 0, elevationDelta: 0 },
] as const satisfies readonly RacingTrackSection[];

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function cosineEase(value: number): number {
  return (1 - Math.cos(Math.PI * value)) / 2;
}

export function createRacingTrack(): RacingTrack {
  const points: RacingTrackPoint[] = [
    { distance: 0, x: 0, z: 0, elevation: 0, heading: 0, curve: 0 },
  ];
  let x = 0;
  let z = 0;
  let elevation = 0;
  let heading = 0;
  let previousCurve = 0;

  for (const section of TRACK_SECTIONS) {
    const sectionStartElevation = elevation;
    for (let index = 1; index <= section.segments; index += 1) {
      const progress = index / section.segments;
      const curve = previousCurve + (section.targetCurve - previousCurve) * smoothStep(progress);
      const nextHeading = heading + curve * RACING_TRACK_SEGMENT_LENGTH;
      const midpointHeading = (heading + nextHeading) / 2;
      x += Math.sin(midpointHeading) * RACING_TRACK_SEGMENT_LENGTH;
      z += Math.cos(midpointHeading) * RACING_TRACK_SEGMENT_LENGTH;
      elevation = sectionStartElevation + section.elevationDelta * cosineEase(progress);
      heading = nextHeading;
      points.push({
        distance: points.length * RACING_TRACK_SEGMENT_LENGTH,
        x,
        z,
        elevation,
        heading,
        curve,
      });
    }
    previousCurve = section.targetCurve;
  }

  const finalPoint = points.at(-1);
  if (finalPoint === undefined) {
    throw new Error("Racing track construction produced no finish point.");
  }
  return {
    points,
    segmentLength: RACING_TRACK_SEGMENT_LENGTH,
    length: finalPoint.distance,
  };
}

export const RACING_TRACK = createRacingTrack();

export function racingTrackPointAt(track: RacingTrack, distance: number): RacingTrackPoint {
  const clampedDistance = Math.min(track.length, Math.max(0, distance));
  const lowerIndex = Math.min(
    track.points.length - 2,
    Math.floor(clampedDistance / track.segmentLength),
  );
  const lower = track.points[lowerIndex];
  const upper = track.points[lowerIndex + 1];
  if (lower === undefined || upper === undefined) {
    throw new Error("Racing track distance resolved outside its point bounds.");
  }
  const progress = (clampedDistance - lower.distance) / track.segmentLength;
  return {
    distance: clampedDistance,
    x: lower.x + (upper.x - lower.x) * progress,
    z: lower.z + (upper.z - lower.z) * progress,
    elevation: lower.elevation + (upper.elevation - lower.elevation) * progress,
    heading: lower.heading + (upper.heading - lower.heading) * progress,
    curve: lower.curve + (upper.curve - lower.curve) * progress,
  };
}

export function racingTrackCurveAt(track: RacingTrack, distance: number): number {
  return racingTrackPointAt(track, distance).curve;
}
