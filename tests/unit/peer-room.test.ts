import type { JoinRoomCallbacks, JoinRoomConfig, MessageAction, Room } from "trystero";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectPeerRoom, type PeerConnectionState } from "../../src/transport/peer-room";

const { joinRoomMock } = vi.hoisted(() => ({ joinRoomMock: vi.fn() }));

vi.mock("trystero", () => ({ joinRoom: joinRoomMock }));

interface RoomHarness {
  room: Room;
  poseAction: MessageAction;
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
  const room = {
    makeAction: vi.fn(() => poseAction),
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
    leave,
    callbacks: () => {
      if (capturedCallbacks === undefined) {
        throw new Error("Room callbacks were not captured.");
      }
      return capturedCallbacks;
    },
  };
}

async function completeHandshake(harness: RoomHarness, role: "phone" | "tv"): Promise<void> {
  const handshake = harness.callbacks().onPeerHandshake;
  if (handshake === undefined) {
    throw new Error("Peer handshake callback is missing.");
  }
  await handshake(
    "peer-one",
    vi.fn(async () => undefined),
    vi.fn(async () => ({
      data: { protocol: "jojixplay-skeleton", role },
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
