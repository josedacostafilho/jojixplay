import { joinRoom, type JsonValue, type Room } from "trystero";
import type { PosePacket } from "../domain/pose";
import { parsePosePacket } from "../domain/pose";
import type { SessionCredentials } from "../session/credentials";

export type PeerRole = "phone" | "tv";
export type PeerConnectionState = "connecting" | "waiting" | "connected" | "disconnected" | "error";

interface PeerRoomOptions {
  role: PeerRole;
  credentials: SessionCredentials;
  onStateChange: (state: PeerConnectionState) => void;
  onPosePacket?: (packet: PosePacket) => void;
}

export interface PosePeerRoom {
  sendPose(packet: PosePacket): Promise<void>;
  close(): Promise<void>;
}

const PROTOCOL = "jojixplay-skeleton";
const APP_ID = "gg.jojixplay.skeleton";

function isValidHandshake(value: unknown, expectedRole: PeerRole): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 && record.protocol === PROTOCOL && record.role === expectedRole
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
          await send({ protocol: PROTOCOL, role: options.role });
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
  let closePromise: Promise<void> | null = null;
  const closeRoom = (): Promise<void> => {
    if (closePromise !== null) {
      return closePromise;
    }
    closed = true;
    poseAction.onMessage = null;
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
    async close() {
      await closeRoom();
    },
  };
}
