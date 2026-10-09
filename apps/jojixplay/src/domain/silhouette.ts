import type { CameraRotation } from "./camera";
import { isRecord, type PosePacket, parsePosePacket } from "./pose";

/** A grid is never finer than the camera image. */
export const SILHOUETTE_MAX_DIMENSION = 2048;

export interface SilhouetteGrid {
  width: number;
  height: number;
  /** Person confidence per cell, 0 to 255, rows from the top of the upright unmirrored image. */
  alpha: Uint8Array;
}

/** A silhouette result: the pose model's mask, with its landmarks alongside. */
export interface SilhouettePacket extends PosePacket {
  silhouette: SilhouetteGrid;
}

export type SilhouettePacketParseResult =
  | { ok: true; value: SilhouettePacket }
  | { ok: false; error: string };

function isDimension(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= SILHOUETTE_MAX_DIMENSION;
}

export function parseSilhouettePacket(value: unknown): SilhouettePacketParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Silhouette packet has an invalid shape." };
  }
  const { silhouette, ...rest } = value;
  const pose = parsePosePacket(rest);
  if (!pose.ok) {
    return pose;
  }
  if (
    !isRecord(silhouette) ||
    Object.keys(silhouette).length !== 3 ||
    !isDimension(silhouette.width) ||
    !isDimension(silhouette.height) ||
    !(silhouette.alpha instanceof Uint8Array) ||
    silhouette.alpha.length !== silhouette.width * silhouette.height
  ) {
    return { ok: false, error: "Silhouette packet grid is invalid." };
  }
  return {
    ok: true,
    value: {
      ...pose.value,
      // The buffer arrived by transfer and belongs to this packet alone.
      silhouette: { width: silhouette.width, height: silhouette.height, alpha: silhouette.alpha },
    },
  };
}

/** A grid wider than this carries no more than the pose model's mask can tell apart. */
export const SILHOUETTE_GRID_WIDTH = 320;

/**
 * Turns a grid measured on the camera's own pixels into one measured on the upright image,
 * matching `rotateNormalizedPoint` for landmarks.
 */
export function uprightGrid(grid: SilhouetteGrid, rotation: CameraRotation): SilhouetteGrid {
  if (rotation === 0) {
    return grid;
  }
  const swaps = rotation === 90 || rotation === 270;
  const width = swaps ? grid.height : grid.width;
  const height = swaps ? grid.width : grid.height;
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX =
        rotation === 90 ? y : rotation === 180 ? grid.width - 1 - x : grid.width - 1 - y;
      const sourceY =
        rotation === 90 ? grid.height - 1 - x : rotation === 180 ? grid.height - 1 - y : x;
      alpha[y * width + x] = grid.alpha[sourceY * grid.width + sourceX] ?? 0;
    }
  }
  return { width, height, alpha };
}
