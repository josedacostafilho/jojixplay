import type { Body, BodyFrame, JointName } from "@jojixplay/game-sdk";
import type { PosePacket } from "../domain/pose";

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

export function toBodyFrame(packet: PosePacket): BodyFrame {
  const bodies: Body[] = packet.poses.map(({ landmarks }) =>
    Object.fromEntries(
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
    ),
  );
  return {
    sequence: packet.sequence,
    capturedAtMs: packet.capturedAtMs,
    width: packet.frame.width,
    height: packet.frame.height,
    epoch: packet.frame.epoch,
    bodies,
  };
}
