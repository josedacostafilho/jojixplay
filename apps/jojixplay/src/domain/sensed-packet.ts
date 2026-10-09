import { type HandPacket, parseHandPacket } from "./hands";
import { isRecord, type PosePacket, parsePosePacket } from "./pose";
import { parseSilhouettePacket, type SilhouettePacket } from "./silhouette";

/** One worker result. Which lists it carries says what was sensed. */
export type SensedPacket = PosePacket | HandPacket | SilhouettePacket;
export type SensedPacketParseResult =
  | { ok: true; value: SensedPacket }
  | { ok: false; error: string };

export function parseSensedPacket(value: unknown): SensedPacketParseResult {
  if (isRecord(value) && Object.hasOwn(value, "silhouette")) return parseSilhouettePacket(value);
  if (isRecord(value) && Object.hasOwn(value, "hands")) return parseHandPacket(value);
  return parsePosePacket(value);
}
