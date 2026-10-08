import { parsePosePacket } from "../../apps/jojixplay/src/domain/pose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "../../apps/jojixplay/src/pose/worker-protocol";

const mediaPipe = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
  createFromOptions: vi.fn(),
  setOptions: vi.fn(),
  detectForVideo: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mediaPipe.forVisionTasks },
  HandLandmarker: { createFromOptions: mediaPipe.createFromOptions },
  PoseLandmarker: { createFromOptions: mediaPipe.createFromOptions },
}));

interface WorkerHarness {
  postMessage: ReturnType<typeof vi.fn<(message: PoseWorkerResponse) => void>>;
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
}

describe("pose worker player limit", () => {
  let worker: WorkerHarness;

  beforeEach(() => {
    vi.resetModules();
    mediaPipe.forVisionTasks.mockReset().mockResolvedValue({});
    mediaPipe.setOptions.mockReset().mockResolvedValue(undefined);
    mediaPipe.detectForVideo.mockReset();
    mediaPipe.createFromOptions.mockReset().mockResolvedValue({
      setOptions: mediaPipe.setOptions,
      detectForVideo: mediaPipe.detectForVideo,
    });
    worker = { postMessage: vi.fn(), onmessage: null };
    vi.stubGlobal("self", worker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates one-pose inference by default and acknowledges in-place two-pose reconfiguration", async () => {
    await import("../../apps/jojixplay/src/pose/pose.worker");

    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "initialize",
          mode: "pose",
          wasmBaseUrl: "/wasm",
          modelUrl: "/pose.task",
          poseLimit: 1,
        },
      }),
    );
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "ready" }));
    expect(mediaPipe.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        numPoses: 1,
        baseOptions: expect.objectContaining({ delegate: "GPU" }),
      }),
    );

    worker.onmessage?.(
      new MessageEvent("message", {
        data: { type: "set-pose-limit", poseLimit: 2 },
      }),
    );
    await vi.waitFor(() =>
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: "pose-limit-set",
        poseLimit: 2,
      }),
    );
    expect(mediaPipe.setOptions).toHaveBeenCalledWith({ numPoses: 2 });

    worker.onmessage?.(
      new MessageEvent("message", {
        data: { type: "reset-tracking" },
      }),
    );
    await vi.waitFor(() =>
      expect(worker.postMessage).toHaveBeenCalledWith({ type: "tracking-reset" }),
    );
    expect(mediaPipe.setOptions).toHaveBeenLastCalledWith({ numPoses: 2 });
  });

  it("rotates detector input and converts unrotated MediaPipe landmarks to canonical space", async () => {
    mediaPipe.detectForVideo.mockImplementation(
      (
        _frame: ImageBitmap,
        _capturedAtMs: number,
        _options: { rotationDegrees: number },
        callback: (result: { landmarks: Array<Array<Record<string, number>>> }) => void,
      ) => {
        callback({
          landmarks: [
            Array.from({ length: 33 }, () => ({
              x: 0.2,
              y: 0.3,
              z: -0.4,
              visibility: 0.8,
            })),
          ],
        });
      },
    );
    await import("../../apps/jojixplay/src/pose/pose.worker");
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "initialize",
          mode: "pose",
          wasmBaseUrl: "/wasm",
          modelUrl: "/pose.task",
          poseLimit: 1,
        },
      }),
    );
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "ready" }));

    const close = vi.fn();
    const frame = { width: 720, height: 1_280, close } as unknown as ImageBitmap;
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "estimate",
          frame,
          capturedAtMs: 123,
          sequence: 4,
          cameraFrame: {
            width: 1_280,
            height: 720,
            layout: "landscape",
            epoch: 2,
          },
          rotation: 90,
        },
      }),
    );

    expect(mediaPipe.detectForVideo).toHaveBeenCalledWith(
      frame,
      123,
      { rotationDegrees: 90 },
      expect.any(Function),
    );
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "result",
      packet: expect.objectContaining({
        sequence: 4,
        frame: {
          width: 1_280,
          height: 720,
          layout: "landscape",
          epoch: 2,
        },
        poses: [
          {
            landmarks: expect.arrayContaining([{ x: 0.7, y: 0.2, z: -0.4, visibility: 0.8 }]),
          },
        ],
      }),
    });
    expect(close).toHaveBeenCalledOnce();
  });
  it.each([0, 90, 180, 270] as const)(
    "publishes valid detected hands at source rotation %s",
    async (rotation) => {
      mediaPipe.detectForVideo.mockReturnValue({
        landmarks: [
          Array.from({ length: 21 }, () => ({ x: 1.02, y: 0.3, z: -0.04, visibility: 0 })),
        ],
        worldLandmarks: [
          Array.from({ length: 21 }, () => ({ x: 0.02, y: 0.03, z: -0.01, visibility: 0 })),
        ],
        handedness: [[{ categoryName: "Left", score: 0.9 }]],
      });
      await import("../../apps/jojixplay/src/pose/pose.worker");
      worker.onmessage?.(
        new MessageEvent("message", {
          data: {
            type: "initialize",
            mode: "hands",
            wasmBaseUrl: "/wasm",
            modelUrl: "/hand.task",
            poseLimit: 1,
          },
        }),
      );
      await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "ready" }));
      expect(mediaPipe.createFromOptions).toHaveBeenCalledOnce();
      expect(mediaPipe.createFromOptions).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          numHands: 2,
          baseOptions: { delegate: "GPU", modelAssetPath: "/hand.task" },
        }),
      );
      const close = vi.fn();
      worker.onmessage?.(
        new MessageEvent("message", {
          data: {
            type: "estimate",
            frame: {
              width: rotation === 90 || rotation === 270 ? 720 : 1280,
              height: rotation === 90 || rotation === 270 ? 1280 : 720,
              close,
            } as unknown as ImageBitmap,
            sequence: 0,
            capturedAtMs: 100,
            cameraFrame: { width: 1280, height: 720, epoch: 0, layout: "landscape" },
            rotation,
          },
        }),
      );
      const result = worker.postMessage.mock.calls.at(-1)?.[0];
      if (result?.type !== "result") throw new Error("Missing hand result");
      expect(parsePosePacket(result.packet)).toEqual({ ok: true, value: result.packet });
      expect(result.packet.hands).toHaveLength(1);
      expect(result.packet.poses).toEqual([]);
      if (rotation === 90) {
        expect(result.packet.hands?.[0]?.landmarks[0]).toEqual({ x: 0.7, y: 1.02, z: -0.04 });
        expect(result.packet.hands?.[0]?.worldLandmarks[0]?.x).toBeCloseTo(-0.03);
        expect(result.packet.hands?.[0]?.worldLandmarks[0]?.y).toBeCloseTo(0.02);
      }
      expect(close).toHaveBeenCalledOnce();
    },
  );
});
