import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TvDisplay } from "../../src/pages/tv-display";

const tvMocks = vi.hoisted(() => ({
  audioStart: vi.fn(async () => undefined),
  audioResume: vi.fn(async () => undefined),
  audioStop: vi.fn(async () => undefined),
  audioPlayCue: vi.fn(),
  createPairingKey: vi.fn(() => "M7PKJ3TDW9HXQ4FV6R2C"),
}));

vi.mock("../../src/audio/audio-engine", () => ({
  AppAudioEngine: class AppAudioEngineMock {
    public constructor(
      private readonly onStateChange: (state: "idle" | "starting" | "running" | "error") => void,
    ) {}

    public get muted(): boolean {
      return false;
    }

    public async start(): Promise<void> {
      this.onStateChange("starting");
      try {
        await tvMocks.audioStart();
        this.onStateChange("running");
      } catch (error) {
        this.onStateChange("error");
        throw error;
      }
    }

    public async resume(): Promise<void> {
      await tvMocks.audioResume();
      this.onStateChange("running");
    }

    public async stop(): Promise<void> {
      await tvMocks.audioStop();
      this.onStateChange("idle");
    }

    public setMuted(): void {}
    public playCue = tvMocks.audioPlayCue;
    public setDrawContact(): void {}
    public setRacingCars(): void {}
  },
}));

vi.mock("../../src/platform/capabilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/platform/capabilities")>()),
  inspectTvDisplayCapabilities: () => ({ supported: true, missing: [] }),
}));

vi.mock("../../src/session/credentials", () => ({
  buildPhonePairingUrl: () => "https://example.test/?mode=phone#key=test",
  createPairingKey: tvMocks.createPairingKey,
  deriveSessionCredentials: async () => ({ roomId: "room", password: "password" }),
  formatPairingKey: () => "M7PK-J3TD-W9HX-Q4FV-6R2C",
}));

vi.mock("../../src/transport/peer-room", () => ({
  connectPeerRoom: () => ({
    close: async () => undefined,
    requestPoseLimit: async (poseLimit: 1 | 2) => poseLimit,
    requestCameraLayout: async (layout: "portrait" | "landscape") => layout,
  }),
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,qr" },
}));

beforeEach(() => {
  tvMocks.audioStart.mockReset().mockResolvedValue(undefined);
  tvMocks.audioResume.mockReset().mockResolvedValue(undefined);
  tvMocks.audioStop.mockReset().mockResolvedValue(undefined);
  tvMocks.audioPlayCue.mockReset();
  tvMocks.createPairingKey.mockClear();
});

afterEach(() => cleanup());

describe("television display startup", () => {
  it("starts sound from the TV activation before creating pairing credentials", async () => {
    render(<TvDisplay />);

    fireEvent.click(screen.getByRole("button", { name: "Start TV mode" }));

    expect(tvMocks.audioStart).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Connect your phone" })).toBeInTheDocument();
    expect(tvMocks.createPairingKey).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("TV pairing key")).toHaveTextContent("M7PK-J3TD-W9HX-Q4FV-6R2C");
  });

  it("blocks pairing and cleans up when sound startup fails", async () => {
    tvMocks.audioStart.mockRejectedValue(new Error("blocked"));
    render(<TvDisplay />);

    fireEvent.click(screen.getByRole("button", { name: "Start TV mode" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("TV mode could not start sound.");
    expect(screen.getByRole("button", { name: "Start TV mode" })).toBeEnabled();
    expect(tvMocks.createPairingKey).not.toHaveBeenCalled();
    expect(tvMocks.audioStop).toHaveBeenCalledOnce();
  });
});
