import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppAudioEngine, type AudioRuntimeState } from "../../src/audio/audio-engine";

class AudioParamMock {
  public value = 1;
  public readonly cancelScheduledValues = vi.fn();
  public readonly exponentialRampToValueAtTime = vi.fn((value: number, _endTime: number) => {
    this.value = value;
  });
  public readonly linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  public readonly setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  public readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class AudioNodeMock {
  public readonly connect = vi.fn(() => this);
  public readonly disconnect = vi.fn();
}

class GainNodeMock extends AudioNodeMock {
  public readonly gain = new AudioParamMock();
}

class OscillatorNodeMock extends AudioNodeMock {
  public type: OscillatorType = "sine";
  public readonly frequency = new AudioParamMock();
  public readonly start = vi.fn();
  public readonly stop = vi.fn();
  public readonly addEventListener = vi.fn();
}

class BufferSourceNodeMock extends AudioNodeMock {
  public buffer: AudioBuffer | null = null;
  public loop = false;
  public readonly start = vi.fn();
  public readonly stop = vi.fn();
  public readonly addEventListener = vi.fn();
}

class FilterNodeMock extends AudioNodeMock {
  public type: BiquadFilterType = "lowpass";
  public readonly frequency = new AudioParamMock();
  public readonly Q = new AudioParamMock();
}

class CompressorNodeMock extends AudioNodeMock {
  public readonly threshold = new AudioParamMock();
  public readonly knee = new AudioParamMock();
  public readonly ratio = new AudioParamMock();
  public readonly attack = new AudioParamMock();
  public readonly release = new AudioParamMock();
}

class PannerNodeMock extends AudioNodeMock {
  public readonly pan = new AudioParamMock();
}

class AudioContextMock {
  public static readonly instances: AudioContextMock[] = [];
  public state: AudioContextState = "suspended";
  public currentTime = 2;
  public readonly sampleRate = 48_000;
  public readonly destination = new AudioNodeMock() as unknown as AudioDestinationNode;
  public readonly gains: GainNodeMock[] = [];
  public readonly oscillators: OscillatorNodeMock[] = [];
  public readonly bufferSources: BufferSourceNodeMock[] = [];
  public readonly resume = vi.fn(async () => {
    this.state = "running";
  });
  public readonly suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  public readonly close = vi.fn(async () => {
    this.state = "closed";
  });

  public constructor() {
    AudioContextMock.instances.push(this);
  }

  public createGain(): GainNode {
    const node = new GainNodeMock();
    this.gains.push(node);
    return node as unknown as GainNode;
  }

  public createOscillator(): OscillatorNode {
    const node = new OscillatorNodeMock();
    this.oscillators.push(node);
    return node as unknown as OscillatorNode;
  }

  public createBufferSource(): AudioBufferSourceNode {
    const node = new BufferSourceNodeMock();
    this.bufferSources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }

  public createBiquadFilter(): BiquadFilterNode {
    return new FilterNodeMock() as unknown as BiquadFilterNode;
  }

  public createDynamicsCompressor(): DynamicsCompressorNode {
    return new CompressorNodeMock() as unknown as DynamicsCompressorNode;
  }

  public createStereoPanner(): StereoPannerNode {
    return new PannerNodeMock() as unknown as StereoPannerNode;
  }

  public createBuffer(_channels: number, length: number): AudioBuffer {
    const samples = new Float32Array(length);
    return {
      getChannelData: () => samples,
    } as unknown as AudioBuffer;
  }
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  AudioContextMock.instances.length = 0;
  vi.stubGlobal("AudioContext", AudioContextMock);
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "hidden");
});

describe("app audio engine", () => {
  it("owns one graph and bounded continuous Draw and Racing voices", async () => {
    const states: AudioRuntimeState[] = [];
    const audio = new AppAudioEngine((state) => states.push(state));

    await audio.start();
    const context = AudioContextMock.instances[0];
    if (context === undefined) {
      throw new Error("Expected one audio context.");
    }
    expect(AudioContextMock.instances).toHaveLength(1);
    expect(states).toEqual(["starting", "running"]);

    audio.playCue({ type: "bubble-pop", radius: 0.05 });
    expect(context.oscillators).toHaveLength(1);

    audio.setDrawContact("pencil");
    audio.setDrawContact("eraser");
    expect(context.bufferSources).toHaveLength(2);

    audio.setRacingCars([
      { slot: "left", speed: 24, offRoad: false, trackingAvailable: true },
      { slot: "right", speed: 31, offRoad: true, trackingAvailable: true },
    ]);
    const oscillatorsAfterTwoCars = context.oscillators.length;
    expect(oscillatorsAfterTwoCars).toBe(5);
    audio.setRacingCars([{ slot: "left", speed: 30, offRoad: false, trackingAvailable: true }]);
    expect(context.oscillators).toHaveLength(oscillatorsAfterTwoCars);

    const sourcesBeforeMute = context.bufferSources.length;
    audio.setMuted(true);
    expect(audio.muted).toBe(true);
    const muteRamp = context.gains[0]?.gain.exponentialRampToValueAtTime.mock.calls.at(-1);
    expect(muteRamp?.[0]).toBe(0.0001);
    expect(muteRamp?.[1]).toBeCloseTo(2.1, 8);
    audio.setMuted(false);
    expect(context.bufferSources.length).toBe(sourcesBeforeMute + 2);
    expect(context.oscillators).toHaveLength(oscillatorsAfterTwoCars + 2);
    audio.setDrawContact(null);
    audio.setRacingCars([]);
    await audio.stop();

    expect(context.close).toHaveBeenCalledOnce();
    expect(states.at(-1)).toBe("idle");
  });

  it("suspends while hidden and resumes the same context when visible", async () => {
    const states: AudioRuntimeState[] = [];
    const audio = new AppAudioEngine((state) => states.push(state));
    await audio.start();
    const context = AudioContextMock.instances[0];
    if (context === undefined) {
      throw new Error("Expected one audio context.");
    }

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(states.at(-1)).toBe("suspended");
    audio.setDrawContact("pencil");
    audio.setRacingCars([{ slot: "solo", speed: 20, offRoad: false, trackingAvailable: true }]);
    const sourcesWhileSuspended = context.bufferSources.length;

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe("running");
    expect(context.bufferSources.length).toBe(sourcesWhileSuspended + 2);

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(context.state).toBe("running");
    expect(states.at(-1)).toBe("running");

    await audio.stop();
  });

  it("rejects startup and closes the partial graph when audio cannot resume", async () => {
    class BlockedAudioContextMock extends AudioContextMock {
      public override readonly resume = vi.fn(async () => {
        throw new Error("blocked");
      });
    }
    vi.stubGlobal("AudioContext", BlockedAudioContextMock);
    const states: AudioRuntimeState[] = [];
    const audio = new AppAudioEngine((state) => states.push(state));

    await expect(audio.start()).rejects.toThrow("Sound could not start on this device.");
    const context = AudioContextMock.instances[0];
    expect(context?.close).toHaveBeenCalledOnce();
    expect(states).toEqual(["starting", "error"]);
  });
});
