import { joinRoom, type JsonValue, type Room } from "trystero";
import type { PosePacket } from "../domain/pose";
import { parsePosePacket } from "../domain/pose";
import { type PoseLimit, type PoseLimitMessage, parsePoseLimitMessage } from "../domain/pose-limit";
import type { SessionCredentials } from "../session/credentials";

export type PeerRole = "phone" | "tv";
export type PeerConnectionState = "connecting" | "waiting" | "connected" | "disconnected" | "error";

interface PeerRoomOptions {
  role: PeerRole;
  credentials: SessionCredentials;
  onStateChange: (state: PeerConnectionState) => void;
  onPosePacket?: (packet: PosePacket) => void;
  onPoseLimitRequest?: (poseLimit: PoseLimit) => Promise<PoseLimit>;
}

export interface PosePeerRoom {
  sendPose(packet: PosePacket): Promise<void>;
  requestPoseLimit(poseLimit: PoseLimit): Promise<PoseLimit>;
  close(): Promise<void>;
}

export const PEER_PROTOCOL = "jojixplay-skeleton/2";
const APP_ID = "gg.jojixplay.skeleton";
const POSE_LIMIT_REQUEST_TIMEOUT_MS = 10_000;

function isValidHandshake(value: unknown, expectedRole: PeerRole): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    record.protocol === PEER_PROTOCOL &&
    record.role === expectedRole
  );
}

export function connectPeerRoom(options: PeerRoomOptions): PosePeerRoom {
  let closed = false;
  let approvedPeerId: string | null = null;
  let handshakingPeerId: string | null = null;
  const expectedRole: PeerRole = options.role === "phone" ? "tv" : "phone";

  options.onStateChange("connecting");

  const room: Room = joinRoom(
    {
      appId: APP_ID,
      password: options.credentials.secret,
      trickleIce: true,
    },
    options.credentials.room,
    {
      handshakeTimeoutMs: 20_000,
      onJoinError: ({ peerId }) => {
        if (closed) {
          return;
        }
        const expectedPeerId = approvedPeerId ?? handshakingPeerId;
        if (expectedPeerId === null || expectedPeerId === peerId) {
          options.onStateChange("error");
        }
      },
      onPeerHandshake: async (peerId, send, receive) => {
        if (
          (approvedPeerId !== null && approvedPeerId !== peerId) ||
          (handshakingPeerId !== null && handshakingPeerId !== peerId)
        ) {
          throw new Error("This session already has a controller/display pair.");
        }

        handshakingPeerId = peerId;
        try {
          const incoming = receive();
          await send({ protocol: PEER_PROTOCOL, role: options.role });
          const handshake = await incoming;
          if (!isValidHandshake(handshake.data, expectedRole)) {
            throw new Error("The peer uses an incompatible role or protocol.");
          }
          approvedPeerId = peerId;
        } finally {
          if (handshakingPeerId === peerId) {
            handshakingPeerId = null;
          }
        }
      },
    },
  );

  const poseAction = room.makeAction("pose");
  const poseLimitAction = room.makeAction("pose-limit", { kind: "request" });
  let closePromise: Promise<void> | null = null;
  const closeRoom = (): Promise<void> => {
    if (closePromise !== null) {
      return closePromise;
    }
    closed = true;
    poseAction.onMessage = null;
    poseLimitAction.onRequest = null;
    room.onPeerJoin = null;
    room.onPeerLeave = null;
    closePromise = room.leave().catch(() => undefined);
    return closePromise;
  };

  if (options.role === "tv") {
    poseAction.onMessage = (data, context) => {
      if (closed || context.peerId !== approvedPeerId) {
        return;
      }
      const parsed = parsePosePacket(data);
      if (parsed.ok) {
        options.onPosePacket?.(parsed.value);
      } else {
        options.onStateChange("error");
        void closeRoom();
      }
    };
  }

  if (options.role === "phone") {
    poseLimitAction.onRequest = async (data, context) => {
      if (closed || context.peerId !== approvedPeerId) {
        throw new Error("Player-mode request is not authorized.");
      }
      const parsed = parsePoseLimitMessage(data);
      if (!parsed.ok || options.onPoseLimitRequest === undefined) {
        options.onStateChange("error");
        void closeRoom();
        throw new Error("Player-mode request is invalid.");
      }

      const appliedPoseLimit = await options.onPoseLimitRequest(parsed.value.poseLimit);
      if (appliedPoseLimit !== parsed.value.poseLimit) {
        options.onStateChange("error");
        void closeRoom();
        throw new Error("Player-mode acknowledgement is invalid.");
      }
      return { poseLimit: appliedPoseLimit } satisfies PoseLimitMessage;
    };
  }

  room.onPeerJoin = (peerId) => {
    if (!closed && peerId === approvedPeerId) {
      options.onStateChange("connected");
    }
  };
  room.onPeerLeave = (peerId) => {
    if (!closed && peerId === approvedPeerId) {
      approvedPeerId = null;
      options.onStateChange("disconnected");
    }
  };

  options.onStateChange("waiting");

  return {
    async sendPose(packet) {
      if (closed || options.role !== "phone" || approvedPeerId === null) {
        return;
      }
      await poseAction.send(packet as unknown as JsonValue, {
        target: approvedPeerId,
      });
    },
    async requestPoseLimit(poseLimit) {
      if (closed || options.role !== "tv" || approvedPeerId === null) {
        throw new Error("The phone is not connected.");
      }
      const requested: PoseLimitMessage = { poseLimit };
      const response = await poseLimitAction.request(requested as unknown as JsonValue, {
        target: approvedPeerId,
        timeoutMs: POSE_LIMIT_REQUEST_TIMEOUT_MS,
      });
      const parsed = parsePoseLimitMessage(response);
      if (!parsed.ok || parsed.value.poseLimit !== poseLimit) {
        options.onStateChange("error");
        void closeRoom();
        throw new Error("The phone returned an invalid player-mode acknowledgement.");
      }
      return parsed.value.poseLimit;
    },
    async close() {
      await closeRoom();
    },
  };
}
