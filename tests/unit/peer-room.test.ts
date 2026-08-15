import type {
  JoinRoomCallbacks,
  JoinRoomConfig,
  MessageAction,
  RequestAction,
  Room,
} from "trystero";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectPeerRoom,
  PEER_PROTOCOL,
  type PeerConnectionState,
} from "../../src/transport/peer-room";

const { joinRoomMock } = vi.hoisted(() => ({ joinRoomMock: vi.fn() }));

vi.mock("trystero", () => ({ joinRoom: joinRoomMock }));

interface RoomHarness {
  room: Room;
  poseAction: MessageAction;
  poseLimitAction: RequestAction;
  cameraLayoutAction: RequestAction;
  leave: ReturnType<typeof vi.fn>;
  callbacks: () => JoinRoomCallbacks;
}

function createRoomHarness(): RoomHarness {
  let capturedCallbacks: JoinRoomCallbacks | undefined;
  const leave = vi.fn(async () => undefined);
  const poseAction: MessageAction = {
    send: vi.fn(async () => undefined),
    onMessage: null,
    onReceiveProgress: null,
  };
  const poseLimitAction: RequestAction = {
    request: vi.fn(async () => ({ poseLimit: 1 })),
    requestMany: vi.fn(async () => []),
    onRequest: null,
    onReceiveProgress: null,
  };
  const cameraLayoutAction: RequestAction = {
    request: vi.fn(async () => ({ cameraLayout: "landscape" })),
    requestMany: vi.fn(async () => []),
    onRequest: null,
    onReceiveProgress: null,
  };
  const room = {
    makeAction: vi.fn((namespace: string) => {
      if (namespace === "pose-limit") {
        return poseLimitAction;
      }
      return namespace === "camera-layout" ? cameraLayoutAction : poseAction;
    }),
    leave,
    onPeerJoin: null,
    onPeerLeave: null,
  } as unknown as Room;

  joinRoomMock.mockImplementation(
    (_config: JoinRoomConfig, _roomId: string, callbacks?: JoinRoomCallbacks) => {
      capturedCallbacks = callbacks;
      return room;
    },
  );

  return {
    room,
    poseAction,
    poseLimitAction,
    cameraLayoutAction,
    leave,
    callbacks: () => {
      if (capturedCallbacks === undefined) {
        throw new Error("Room callbacks were not captured.");
      }
      return capturedCallbacks;
    },
  };
}

async function completeHandshake(
  harness: RoomHarness,
  role: "phone" | "tv",
  protocol = PEER_PROTOCOL,
): Promise<void> {
  const handshake = harness.callbacks().onPeerHandshake;
  if (handshake === undefined) {
    throw new Error("Peer handshake callback is missing.");
  }
  await handshake(
    "peer-one",
    vi.fn(async () => undefined),
    vi.fn(async () => ({
      data: { protocol, role },
    })),
    true,
  );
}

describe("peer room", () => {
  beforeEach(() => {
    joinRoomMock.mockReset();
  });

  it("accepts the opposite role and terminates on a malformed pose packet", async () => {
    const harness = createRoomHarness();
    const states: PeerConnectionState[] = [];
    connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: (state) => states.push(state),
    });

    await completeHandshake(harness, "phone");
    harness.room.onPeerJoin?.("peer-one");
    await harness.poseAction.onMessage?.({ malformed: true }, { peerId: "peer-one" });

    expect(states).toEqual(["connecting", "waiting", "connected", "error"]);
    expect(harness.leave).toHaveBeenCalledOnce();
  });

  it("rejects a peer with the same role", async () => {
    const harness = createRoomHarness();
    connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: vi.fn(),
    });

    await expect(completeHandshake(harness, "tv")).rejects.toThrow("incompatible role or protocol");
  });

  it("rejects the superseded peer protocol", async () => {
    const harness = createRoomHarness();
    connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: vi.fn(),
    });

    for (const protocol of ["jojixplay-skeleton", "jojixplay-skeleton/2"]) {
      await expect(completeHandshake(harness, "phone", protocol)).rejects.toThrow(
        "incompatible role or protocol",
      );
    }
  });

  it("requests an absolute player limit and accepts only its matching acknowledgement", async () => {
    const harness = createRoomHarness();
    vi.mocked(harness.poseLimitAction.request).mockResolvedValue({ poseLimit: 2 });
    const peerRoom = connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: vi.fn(),
    });

    await completeHandshake(harness, "phone");
    harness.room.onPeerJoin?.("peer-one");

    await expect(peerRoom.requestPoseLimit(2)).resolves.toBe(2);
    expect(harness.poseLimitAction.request).toHaveBeenCalledWith(
      { poseLimit: 2 },
      { target: "peer-one", timeoutMs: 10_000 },
    );
  });

  it("terminates when the phone acknowledges a different player limit", async () => {
    const harness = createRoomHarness();
    const states: PeerConnectionState[] = [];
    vi.mocked(harness.poseLimitAction.request).mockResolvedValue({ poseLimit: 1 });
    const peerRoom = connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: (state) => states.push(state),
    });

    await completeHandshake(harness, "phone");
    harness.room.onPeerJoin?.("peer-one");

    await expect(peerRoom.requestPoseLimit(2)).rejects.toThrow("invalid player-mode");
    expect(states.at(-1)).toBe("error");
    expect(harness.leave).toHaveBeenCalledOnce();
  });

  it("applies an authorized player-limit request on the phone and returns its acknowledgement", async () => {
    const harness = createRoomHarness();
    const onPoseLimitRequest = vi.fn(async (poseLimit: 1 | 2) => poseLimit);
    connectPeerRoom({
      role: "phone",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: vi.fn(),
      onPoseLimitRequest,
    });

    await completeHandshake(harness, "tv");
    harness.room.onPeerJoin?.("peer-one");
    const response = await harness.poseLimitAction.onRequest?.(
      { poseLimit: 2 },
      { peerId: "peer-one", signal: new AbortController().signal },
    );

    expect(onPoseLimitRequest).toHaveBeenCalledWith(2);
    expect(response).toEqual({ poseLimit: 2 });
  });

  it("terminates when an authorized player-limit request has extra fields", async () => {
    const harness = createRoomHarness();
    const states: PeerConnectionState[] = [];
    const onPoseLimitRequest = vi.fn(async (poseLimit: 1 | 2) => poseLimit);
    connectPeerRoom({
      role: "phone",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: (state) => states.push(state),
      onPoseLimitRequest,
    });

    await completeHandshake(harness, "tv");
    harness.room.onPeerJoin?.("peer-one");

    await expect(
      harness.poseLimitAction.onRequest?.(
        { poseLimit: 2, legacy: true },
        { peerId: "peer-one", signal: new AbortController().signal },
      ),
    ).rejects.toThrow("invalid");
    expect(onPoseLimitRequest).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe("error");
    expect(harness.leave).toHaveBeenCalledOnce();
  });

  it("rejects an unauthorized player-limit request without invoking the phone", async () => {
    const harness = createRoomHarness();
    const onPoseLimitRequest = vi.fn(async (poseLimit: 1 | 2) => poseLimit);
    connectPeerRoom({
      role: "phone",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: vi.fn(),
      onPoseLimitRequest,
    });

    await completeHandshake(harness, "tv");
    harness.room.onPeerJoin?.("peer-one");

    await expect(
      harness.poseLimitAction.onRequest?.(
        { poseLimit: 2 },
        { peerId: "peer-two", signal: new AbortController().signal },
      ),
    ).rejects.toThrow("not authorized");
    expect(onPoseLimitRequest).not.toHaveBeenCalled();
  });

  it("requests an absolute camera layout and accepts only its matching acknowledgement", async () => {
    const harness = createRoomHarness();
    vi.mocked(harness.cameraLayoutAction.request).mockResolvedValue({
      cameraLayout: "portrait",
    });
    const peerRoom = connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: vi.fn(),
    });

    await completeHandshake(harness, "phone");
    harness.room.onPeerJoin?.("peer-one");

    await expect(peerRoom.requestCameraLayout("portrait")).resolves.toBe("portrait");
    expect(harness.cameraLayoutAction.request).toHaveBeenCalledWith(
      { cameraLayout: "portrait" },
      { target: "peer-one", timeoutMs: 35_000 },
    );
  });

  it("applies only a strict authorized camera-layout request on the phone", async () => {
    const harness = createRoomHarness();
    const states: PeerConnectionState[] = [];
    const onCameraLayoutRequest = vi.fn(async (layout: "portrait" | "landscape") => layout);
    connectPeerRoom({
      role: "phone",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: (state) => states.push(state),
      onCameraLayoutRequest,
    });

    await completeHandshake(harness, "tv");
    harness.room.onPeerJoin?.("peer-one");
    const context = { peerId: "peer-one", signal: new AbortController().signal };
    await expect(
      harness.cameraLayoutAction.onRequest?.({ cameraLayout: "landscape" }, context),
    ).resolves.toEqual({ cameraLayout: "landscape" });
    expect(onCameraLayoutRequest).toHaveBeenCalledWith("landscape");

    await expect(
      harness.cameraLayoutAction.onRequest?.({ cameraLayout: "landscape", legacy: true }, context),
    ).rejects.toThrow("invalid");
    expect(states.at(-1)).toBe("error");
    expect(harness.leave).toHaveBeenCalledOnce();
  });

  it("does not poison an active pair when an extra peer fails", async () => {
    const harness = createRoomHarness();
    const states: PeerConnectionState[] = [];
    connectPeerRoom({
      role: "tv",
      credentials: {
        room: "abcdefghijklmnopqrstuv",
        secret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      },
      onStateChange: (state) => states.push(state),
    });

    await completeHandshake(harness, "phone");
    harness.room.onPeerJoin?.("peer-one");
    harness.callbacks().onJoinError?.({
      error: "extra peer failed",
      appId: "gg.jojixplay.skeleton",
      roomId: "abcdefghijklmnopqrstuv",
      peerId: "peer-two",
    });

    expect(states.at(-1)).toBe("connected");
  });
});
