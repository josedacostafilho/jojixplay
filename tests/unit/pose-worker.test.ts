import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "../../apps/jojixplay/src/pose/worker-protocol";

const mediaPipe = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
  createFromOptions: vi.fn(),
  createHands: vi.fn(),
  detectHands: vi.fn(),
  setOptions: vi.fn(),
  detectForVideo: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mediaPipe.forVisionTasks },
  PoseLandmarker: { createFromOptions: mediaPipe.createFromOptions },
  HandLandmarker: { createFromOptions: mediaPipe.createHands },
}));

interface WorkerHarness {
  postMessage: ReturnType<
    typeof vi.fn<(message: PoseWorkerResponse, transfer?: Transferable[]) => void>
  >;
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
    mediaPipe.detectHands.mockReset();
    mediaPipe.createHands.mockReset().mockResolvedValue({
      setOptions: mediaPipe.setOptions,
      detectForVideo: mediaPipe.detectHands,
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
          wasmBaseUrl: "/wasm",
          sensing: "body",
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
        callback: (result: {
          landmarks: Array<Array<Record<string, number>>>;
          worldLandmarks: Array<Array<Record<string, number>>>;
        }) => void,
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
          worldLandmarks: [Array.from({ length: 33 }, () => ({ x: 0.1, y: 0.2, z: -0.3 }))],
        });
      },
    );
    await import("../../apps/jojixplay/src/pose/pose.worker");
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "initialize",
          wasmBaseUrl: "/wasm",
          sensing: "body",
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
            // A direction from the hips turns with the image and is not shifted with it.
            world: expect.arrayContaining([
              { x: expect.closeTo(-0.2), y: expect.closeTo(0.1), z: -0.3 },
            ]),
          },
        ],
      }),
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("senses two hands instead of poses when started for hands and reports rotated landmarks", async () => {
    mediaPipe.detectHands.mockReturnValue({
      landmarks: [Array.from({ length: 21 }, () => ({ x: 0.2, y: 0.3, z: -0.1 }))],
      handedness: [[{ categoryName: "Left", score: 0.9 }]],
    });
    await import("../../apps/jojixplay/src/pose/pose.worker");
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "initialize",
          wasmBaseUrl: "/wasm",
          sensing: "hands",
          modelUrl: "/hands.task",
          poseLimit: 1,
        },
      }),
    );
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "ready" }));
    // One model per worker: no pose task exists beside the hand task.
    expect(mediaPipe.createFromOptions).not.toHaveBeenCalled();
    expect(mediaPipe.createHands).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        numHands: 2,
        baseOptions: { delegate: "GPU", modelAssetPath: "/hands.task" },
      }),
    );

    const close = vi.fn();
    const frame = { width: 720, height: 1_280, close } as unknown as ImageBitmap;
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "estimate",
          frame,
          capturedAtMs: 123,
          sequence: 4,
          cameraFrame: { width: 1_280, height: 720, layout: "landscape", epoch: 2 },
          rotation: 90,
        },
      }),
    );
    expect(mediaPipe.detectHands).toHaveBeenCalledWith(frame, 123, { rotationDegrees: 90 });
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      type: "result",
      packet: {
        sequence: 4,
        capturedAtMs: 123,
        frame: { width: 1_280, height: 720, layout: "landscape", epoch: 2 },
        hands: [
          {
            label: "left",
            score: 0.9,
            landmarks: Array.from({ length: 21 }, () => ({ x: 0.7, y: 0.2, z: -0.1 })),
          },
        ],
      },
    });
    expect(close).toHaveBeenCalledOnce();
  });

  function start(sensing: "silhouette") {
    worker.onmessage?.(
      new MessageEvent("message", {
        data: { type: "initialize", wasmBaseUrl: "/wasm", sensing, modelUrl: "/m", poseLimit: 2 },
      }),
    );
    return vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "ready" }));
  }
  function estimate() {
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "estimate",
          frame: { width: 1_280, height: 720, close: vi.fn() } as unknown as ImageBitmap,
          capturedAtMs: 9,
          sequence: 0,
          cameraFrame: { width: 1_280, height: 720, layout: "landscape", epoch: 0 },
          rotation: 0,
        },
      }),
    );
  }
  it("reads the pose model's GPU masks itself and reports everyone as one silhouette with their joints", async () => {
    // MediaPipe's own array conversion returns zeros for these textures, so it must not be used.
    const bound: Record<string, unknown> = {};
    let attached: number[] = [];
    let blitted: number[] = [];
    const gl = {
      READ_FRAMEBUFFER: "read",
      DRAW_FRAMEBUFFER: "draw",
      RENDERBUFFER: "store",
      READ_FRAMEBUFFER_BINDING: "read",
      DRAW_FRAMEBUFFER_BINDING: "draw",
      RENDERBUFFER_BINDING: "store",
      createFramebuffer: () => ({}),
      createRenderbuffer: () => ({}),
      getParameter: (name: string) => bound[name] ?? "mediapipe's own",
      bindFramebuffer: (target: string, value: unknown) => {
        bound[target] = value;
      },
      bindRenderbuffer: (target: string, value: unknown) => {
        bound[target] = value;
      },
      renderbufferStorage: vi.fn(),
      framebufferRenderbuffer: vi.fn(),
      framebufferTexture2D: (_t: unknown, _a: unknown, _k: unknown, texture: number[]) => {
        attached = texture;
      },
      blitFramebuffer: () => {
        blitted = attached;
      },
      // Red carries the mask; the other channels must be ignored.
      readPixels: (...args: unknown[]) => {
        (args[6] as Uint8Array).set(blitted.flatMap((red) => [red, 9, 9, 255]));
      },
    };
    const gpuMask = (red: number[]) => ({
      width: 2,
      height: 1,
      canvas: { getContext: () => gl },
      getAsWebGLTexture: () => red,
      getAsFloat32Array: () => new Float32Array(2),
    });
    mediaPipe.detectForVideo.mockImplementation((_frame, _time, _options, callback) => {
      callback({
        landmarks: [Array.from({ length: 33 }, () => ({ x: 0.2, y: 0.3, z: 0, visibility: 1 }))],
        worldLandmarks: [Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))],
        segmentationMasks: [gpuMask([255, 0]), gpuMask([0, 128])],
      });
    });
    await import("../../apps/jojixplay/src/pose/pose.worker");
    await start("silhouette");
    expect(mediaPipe.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        outputSegmentationMasks: true,
        numPoses: 2,
        baseOptions: { delegate: "GPU", modelAssetPath: "/m" },
      }),
    );

    estimate();
    const [message, transfer] = worker.postMessage.mock.lastCall ?? [];
    expect(message).toMatchObject({
      type: "result",
      packet: { sequence: 0, silhouette: { width: 2, height: 1 } },
    });
    if (message?.type !== "result" || !("silhouette" in message.packet)) throw new Error("No grid");
    expect(Array.from(message.packet.silhouette.alpha)).toEqual([255, 128]);
    expect(message.packet.poses).toHaveLength(1);
    // The grid is handed over, not copied.
    expect(transfer).toEqual([message.packet.silhouette.alpha.buffer]);
    // MediaPipe goes on drawing with the same context, so its bindings are put back.
    expect(bound).toEqual({
      read: "mediapipe's own",
      draw: "mediapipe's own",
      store: "mediapipe's own",
    });
  });
});
