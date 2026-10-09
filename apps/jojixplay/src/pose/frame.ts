import {
  type Body,
  type Frame,
  type Hand,
  type HandPoint,
  type HandPointName,
  handPointNames,
  type JointName,
  type Sensing,
} from "@jojixplay/game-sdk";
import type { DetectedHand } from "../domain/hands";
import type { SensedPacket } from "../domain/sensed-packet";
import type { DetectedPose } from "../domain/pose";

const jointIndices: ReadonlyArray<readonly [JointName, number]> = [
  ["nose", 0],
  ["leftEye", 2],
  ["rightEye", 5],
  ["leftEar", 7],
  ["rightEar", 8],
  ["leftShoulder", 11],
  ["rightShoulder", 12],
  ["leftElbow", 13],
  ["rightElbow", 14],
  ["leftWrist", 15],
  ["rightWrist", 16],
  ["leftPinky", 17],
  ["rightPinky", 18],
  ["leftIndex", 19],
  ["rightIndex", 20],
  ["leftThumb", 21],
  ["rightThumb", 22],
  ["leftHip", 23],
  ["rightHip", 24],
  ["leftKnee", 25],
  ["rightKnee", 26],
  ["leftAnkle", 27],
  ["rightAnkle", 28],
  ["leftHeel", 29],
  ["rightHeel", 30],
  ["leftFoot", 31],
  ["rightFoot", 32],
];

function toBody({ landmarks }: DetectedPose): Body {
  return Object.fromEntries(
    jointIndices.flatMap(([name, index]) => {
      const point = landmarks[index];
      if (
        !point ||
        point.visibility < 0.6 ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
      )
        return [];
      return [[name, { x: point.x, y: point.y, z: point.z, confidence: point.visibility }]];
    }),
  );
}

function toHand({ label, score, landmarks }: DetectedHand): Hand {
  return {
    // On our unmirrored image the model's label is already the person's own side.
    side: label,
    confidence: score,
    points: Object.fromEntries(
      handPointNames.map((name, index) => [name, landmarks[index]]),
    ) as Record<HandPointName, HandPoint>,
  };
}

/** `sensing` is what the worker that produced the packet was started for. */
export function toFrame(packet: SensedPacket, sensing: Sensing): Frame {
  const hands = "hands" in packet;
  return {
    sequence: packet.sequence,
    capturedAtMs: packet.capturedAtMs,
    width: packet.frame.width,
    height: packet.frame.height,
    epoch: packet.frame.epoch,
    sensing,
    bodies: hands ? [] : packet.poses.map(toBody),
    hands: hands ? packet.hands.map(toHand) : [],
    silhouette: "silhouette" in packet ? packet.silhouette : null,
  };
}
