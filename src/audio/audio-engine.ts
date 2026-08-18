import type { RacingPlayerSlot } from "../games/racing/racing-input";
import { RACING_MAX_SPEED } from "../games/racing/racing-session";

export type AudioRuntimeState = "idle" | "starting" | "running" | "suspended" | "error";

export type AudioCue =
  | { type: "ui-activate" }
  | { type: "ui-back" }
  | { type: "ui-error" }
  | { type: "ui-success" }
  | { type: "draw-tool"; tool: "pencil" | "eraser" }
  | { type: "draw-color" }
  | { type: "draw-clear" }
  | { type: "bubbles-countdown"; count: number }
  | { type: "bubbles-go" }
  | { type: "bubble-pop"; radius: number }
  | { type: "bubbles-finish" }
  | { type: "racing-countdown"; count: number }
  | { type: "racing-go" }
  | { type: "racing-pause" }
  | { type: "racing-resume" }
  | { type: "racing-finish" };

export interface RacingAudioCar {
  slot: RacingPlayerSlot;
  speed: number;
  offRoad: boolean;
  trackingAvailable: boolean;
}

export interface PlayfieldAudio {
  readonly muted: boolean;
  setMuted(muted: boolean): void;
  playCue(cue: AudioCue): void;
  setDrawContact(tool: "pencil" | "eraser" | null): void;
  setRacingCars(cars: readonly RacingAudioCar[]): void;
}

interface DrawingVoice {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface EngineVoice {
  primary: OscillatorNode;
  secondary: OscillatorNode;
  primaryGain: GainNode;
  secondaryGain: GainNode;
  noise: AudioBufferSourceNode;
  noiseGain: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

interface ToneOptions {
  startFrequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  delay?: number;
  type?: OscillatorType;
}

const MASTER_GAIN = 0.52;
const SILENT_GAIN = 0.0001;
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.round(context.sampleRate * 0.5));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let randomState = 0x51f15e;
  for (let index = 0; index < data.length; index += 1) {
    randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
    data[index] = (randomState / 0xffff_ffff) * 2 - 1;
  }
  return buffer;
}

export class AppAudioEngine implements PlayfieldAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private activityGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private drawVoice: DrawingVoice | null = null;
  private readonly engineVoices = new Map<RacingAudioCar["slot"], EngineVoice>();
  private desiredDrawTool: "pencil" | "eraser" | null = null;
  private desiredRacingCars: readonly RacingAudioCar[] = [];
  private runtimeState: AudioRuntimeState = "idle";
  private transitionToken = 0;
  private visibilityOperation: Promise<void> = Promise.resolve();
  private isMuted = false;

  public constructor(
    private readonly onStateChange: (state: AudioRuntimeState) => void = () => undefined,
  ) {}

  public get state(): AudioRuntimeState {
    return this.runtimeState;
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public async start(): Promise<void> {
    if (this.context !== null) {
      await this.resume();
      return;
    }
    this.setState("starting");
    const token = ++this.transitionToken;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext({ latencyHint: "interactive" });
      const masterGain = context.createGain();
      const effectsGain = context.createGain();
      const activityGain = context.createGain();
      const engineGain = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const now = context.currentTime;
      masterGain.gain.setValueAtTime(this.isMuted ? SILENT_GAIN : MASTER_GAIN, now);
      effectsGain.gain.setValueAtTime(0.72, now);
      activityGain.gain.setValueAtTime(0.46, now);
      engineGain.gain.setValueAtTime(0.52, now);
      compressor.threshold.setValueAtTime(-18, now);
      compressor.knee.setValueAtTime(16, now);
      compressor.ratio.setValueAtTime(5, now);
      compressor.attack.setValueAtTime(0.005, now);
      compressor.release.setValueAtTime(0.16, now);
      effectsGain.connect(masterGain);
      activityGain.connect(masterGain);
      engineGain.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(context.destination);

      this.context = context;
      this.masterGain = masterGain;
      this.effectsGain = effectsGain;
      this.activityGain = activityGain;
      this.engineGain = engineGain;
      this.compressor = compressor;
      this.noiseBuffer = createNoiseBuffer(context);
      document.addEventListener("visibilitychange", this.handleVisibilityChange);

      if (context.state !== "running") {
        await context.resume();
      }
      if (token !== this.transitionToken || this.context !== context) {
        throw new Error("Sound startup was cancelled.");
      }
      if (context.state !== "running") {
        throw new Error("The browser did not start its audio output.");
      }
      this.setState("running");
      this.restoreContinuousState();
    } catch {
      if (token !== this.transitionToken || (context !== null && this.context !== context)) {
        throw new Error("Sound startup was cancelled.");
      }
      if (context !== null && this.context === context) {
        await this.closeContext();
      }
      this.setState("error");
      throw new Error("Sound could not start on this device.");
    }
  }

  public async resume(): Promise<void> {
    const context = this.context;
    if (context === null) {
      await this.start();
      return;
    }
    const token = ++this.transitionToken;
    try {
      if (context.state !== "running") {
        await context.resume();
      }
      if (token !== this.transitionToken || this.context !== context) {
        return;
      }
      if (context.state !== "running") {
        throw new Error("Audio output remains suspended.");
      }
      this.setState("running");
      this.restoreContinuousState();
    } catch {
      if (token === this.transitionToken && this.context === context) {
        this.setState("error");
      }
      throw new Error("Sound could not resume. Press the sound button and try again.");
    }
  }

  public async stop(): Promise<void> {
    ++this.transitionToken;
    this.desiredDrawTool = null;
    this.desiredRacingCars = [];
    await this.closeContext();
    this.setState("idle");
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    const context = this.context;
    const masterGain = this.masterGain;
    if (context === null || masterGain === null) {
      return;
    }
    const now = context.currentTime;
    const rampAt = muted ? now + 0.075 : now;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(Math.max(SILENT_GAIN, masterGain.gain.value), now);
    masterGain.gain.setValueAtTime(Math.max(SILENT_GAIN, masterGain.gain.value), rampAt);
    masterGain.gain.exponentialRampToValueAtTime(muted ? SILENT_GAIN : MASTER_GAIN, rampAt + 0.025);
    if (muted) {
      this.stopDrawVoice();
      this.stopEngineVoices();
    } else {
      this.restoreContinuousState();
    }
  }

  public playCue(cue: AudioCue): void {
    if (!this.canPlay()) {
      return;
    }
    try {
      switch (cue.type) {
        case "ui-activate":
          this.tone({ startFrequency: 520, endFrequency: 700, duration: 0.085, gain: 0.075 });
          break;
        case "ui-back":
          this.tone({ startFrequency: 440, endFrequency: 290, duration: 0.1, gain: 0.065 });
          break;
        case "ui-error":
          this.tone({
            startFrequency: 190,
            endFrequency: 115,
            duration: 0.2,
            gain: 0.09,
            type: "sawtooth",
          });
          break;
        case "ui-success":
          this.tone({ startFrequency: 440, endFrequency: 660, duration: 0.12, gain: 0.075 });
          this.tone({
            startFrequency: 660,
            endFrequency: 880,
            duration: 0.13,
            gain: 0.06,
            delay: 0.09,
          });
          break;
        case "draw-tool":
          this.tone({
            startFrequency: cue.tool === "pencil" ? 610 : 360,
            endFrequency: cue.tool === "pencil" ? 780 : 280,
            duration: 0.09,
            gain: 0.055,
            type: cue.tool === "pencil" ? "triangle" : "sine",
          });
          break;
        case "draw-color":
          this.tone({ startFrequency: 690, endFrequency: 980, duration: 0.11, gain: 0.06 });
          break;
        case "draw-clear":
          this.noiseBurst(0.24, 0.08, 1_600, 240);
          this.tone({ startFrequency: 520, endFrequency: 180, duration: 0.2, gain: 0.045 });
          break;
        case "bubbles-countdown":
          this.tone({
            startFrequency: 360 + (3 - clamp(cue.count, 1, 3)) * 35,
            endFrequency: 400 + (3 - clamp(cue.count, 1, 3)) * 35,
            duration: 0.11,
            gain: 0.085,
          });
          break;
        case "bubbles-go":
          this.tone({ startFrequency: 620, endFrequency: 940, duration: 0.18, gain: 0.1 });
          break;
        case "bubble-pop": {
          const size = clamp((cue.radius - 0.03) / 0.04, 0, 1);
          const frequency = 980 - size * 500;
          this.tone({
            startFrequency: frequency * 1.12,
            endFrequency: frequency,
            duration: 0.085 + size * 0.035,
            gain: 0.07,
            type: "sine",
          });
          this.noiseBurst(0.055, 0.035, frequency * 1.8, frequency * 0.8);
          break;
        }
        case "bubbles-finish":
          this.tone({ startFrequency: 520, endFrequency: 390, duration: 0.15, gain: 0.08 });
          this.tone({
            startFrequency: 390,
            endFrequency: 260,
            duration: 0.18,
            gain: 0.075,
            delay: 0.12,
          });
          break;
        case "racing-countdown":
          this.tone({
            startFrequency: 280 + (3 - clamp(cue.count, 1, 3)) * 32,
            endFrequency: 310 + (3 - clamp(cue.count, 1, 3)) * 32,
            duration: 0.12,
            gain: 0.09,
          });
          break;
        case "racing-go":
          this.tone({ startFrequency: 520, endFrequency: 880, duration: 0.24, gain: 0.11 });
          break;
        case "racing-pause":
          this.tone({ startFrequency: 330, endFrequency: 170, duration: 0.18, gain: 0.085 });
          break;
        case "racing-resume":
          this.tone({ startFrequency: 300, endFrequency: 540, duration: 0.16, gain: 0.08 });
          break;
        case "racing-finish":
          for (const [index, frequency] of [440, 554, 659, 880].entries()) {
            this.tone({
              startFrequency: frequency,
              endFrequency: frequency * 1.03,
              duration: 0.2,
              gain: 0.075,
              delay: index * 0.11,
            });
          }
          break;
      }
    } catch {
      this.setState("error");
    }
  }

  public setDrawContact(tool: "pencil" | "eraser" | null): void {
    this.desiredDrawTool = tool;
    this.applyDrawContact();
  }

  public setRacingCars(cars: readonly RacingAudioCar[]): void {
    this.desiredRacingCars = cars.map((car) => ({ ...car }));
    this.applyRacingCars();
  }

  private applyDrawContact(): void {
    const tool = this.desiredDrawTool;
    if (tool === null || !this.canPlay()) {
      this.stopDrawVoice();
      return;
    }
    try {
      const context = this.context;
      const activityGain = this.activityGain;
      const noiseBuffer = this.noiseBuffer;
      if (context === null || activityGain === null || noiseBuffer === null) {
        return;
      }
      if (this.drawVoice === null) {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = noiseBuffer;
        source.loop = true;
        filter.type = "bandpass";
        source.connect(filter);
        filter.connect(gain);
        gain.connect(activityGain);
        gain.gain.setValueAtTime(SILENT_GAIN, context.currentTime);
        source.start();
        this.drawVoice = { source, filter, gain };
      }
      const now = context.currentTime;
      const voice = this.drawVoice;
      voice.filter.frequency.cancelScheduledValues(now);
      voice.filter.frequency.setTargetAtTime(tool === "pencil" ? 1_800 : 620, now, 0.025);
      voice.filter.Q.setTargetAtTime(tool === "pencil" ? 1.4 : 0.75, now, 0.025);
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(tool === "pencil" ? 0.035 : 0.05, now, 0.018);
    } catch {
      this.stopDrawVoice();
      this.setState("error");
    }
  }

  private applyRacingCars(): void {
    if (!this.canPlay()) {
      this.stopEngineVoices();
      return;
    }
    try {
      const cars = this.desiredRacingCars;
      const activeSlots = new Set(cars.map(({ slot }) => slot));
      for (const slot of this.engineVoices.keys()) {
        if (!activeSlots.has(slot)) {
          this.stopEngineVoice(slot);
        }
      }
      for (const car of cars) {
        const voice = this.engineVoices.get(car.slot) ?? this.createEngineVoice(car.slot);
        this.updateEngineVoice(voice, car);
      }
    } catch {
      this.stopEngineVoices();
      this.setState("error");
    }
  }

  private restoreContinuousState(): void {
    this.applyDrawContact();
    this.applyRacingCars();
  }

  private canPlay(): boolean {
    return this.context?.state === "running" && this.runtimeState === "running" && !this.isMuted;
  }

  private tone(options: ToneOptions): void {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (context === null || effectsGain === null) {
      return;
    }
    const startAt = context.currentTime + (options.delay ?? 0);
    const stopAt = startAt + options.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(options.startFrequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, stopAt);
    gain.gain.setValueAtTime(SILENT_GAIN, startAt);
    gain.gain.exponentialRampToValueAtTime(options.gain, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, stopAt);
    oscillator.connect(gain);
    gain.connect(effectsGain);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
    oscillator.start(startAt);
    oscillator.stop(stopAt + 0.01);
  }

  private noiseBurst(
    duration: number,
    gainValue: number,
    startFrequency: number,
    endFrequency: number,
  ): void {
    const context = this.context;
    const effectsGain = this.effectsGain;
    const noiseBuffer = this.noiseBuffer;
    if (context === null || effectsGain === null || noiseBuffer === null) {
      return;
    }
    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(startFrequency, now);
    filter.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(effectsGain);
    source.addEventListener(
      "ended",
      () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
    source.start(now);
    source.stop(now + duration + 0.01);
  }

  private createEngineVoice(slot: RacingAudioCar["slot"]): EngineVoice {
    const context = this.context;
    const engineGain = this.engineGain;
    const noiseBuffer = this.noiseBuffer;
    if (context === null || engineGain === null || noiseBuffer === null) {
      throw new Error("Racing audio cannot start without an active graph.");
    }
    const primary = context.createOscillator();
    const secondary = context.createOscillator();
    const primaryGain = context.createGain();
    const secondaryGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseGain = context.createGain();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const now = context.currentTime;
    primary.type = "sawtooth";
    secondary.type = "triangle";
    noise.buffer = noiseBuffer;
    noise.loop = true;
    primaryGain.gain.setValueAtTime(0.68, now);
    secondaryGain.gain.setValueAtTime(0.32, now);
    noiseGain.gain.setValueAtTime(SILENT_GAIN, now);
    filter.type = "lowpass";
    filter.Q.setValueAtTime(1.8, now);
    gain.gain.setValueAtTime(SILENT_GAIN, now);
    panner.pan.setValueAtTime(slot === "left" ? -0.35 : slot === "right" ? 0.35 : 0, now);
    primary.connect(primaryGain);
    secondary.connect(secondaryGain);
    primaryGain.connect(filter);
    secondaryGain.connect(filter);
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(engineGain);
    primary.start();
    secondary.start();
    noise.start();
    const voice = {
      primary,
      secondary,
      primaryGain,
      secondaryGain,
      noise,
      noiseGain,
      filter,
      gain,
      panner,
    };
    this.engineVoices.set(slot, voice);
    return voice;
  }

  private updateEngineVoice(voice: EngineVoice, car: RacingAudioCar): void {
    const context = this.context;
    if (context === null) {
      return;
    }
    const now = context.currentTime;
    const speedRatio = clamp(car.speed / RACING_MAX_SPEED, 0, 1);
    const baseFrequency = 48 + speedRatio * 126;
    const targetGain = car.trackingAvailable ? 0.055 + speedRatio * 0.045 : 0.035;
    voice.primary.frequency.setTargetAtTime(baseFrequency, now, 0.08);
    voice.secondary.frequency.setTargetAtTime(baseFrequency * 2.01, now, 0.08);
    voice.filter.frequency.setTargetAtTime(420 + speedRatio * 1_650, now, 0.08);
    voice.gain.gain.setTargetAtTime(targetGain, now, 0.06);
    voice.noiseGain.gain.setTargetAtTime(car.offRoad ? 0.18 : SILENT_GAIN, now, 0.04);
  }

  private stopDrawVoice(): void {
    const voice = this.drawVoice;
    this.drawVoice = null;
    if (voice === null) {
      return;
    }
    try {
      voice.source.stop();
    } catch {
      // The source may already have ended during context teardown.
    }
    voice.source.disconnect();
    voice.filter.disconnect();
    voice.gain.disconnect();
  }

  private stopEngineVoice(slot: RacingAudioCar["slot"]): void {
    const voice = this.engineVoices.get(slot);
    if (voice === undefined) {
      return;
    }
    this.engineVoices.delete(slot);
    for (const source of [voice.primary, voice.secondary, voice.noise]) {
      try {
        source.stop();
      } catch {
        // The source may already have ended during context teardown.
      }
      source.disconnect();
    }
    voice.primaryGain.disconnect();
    voice.secondaryGain.disconnect();
    voice.noiseGain.disconnect();
    voice.filter.disconnect();
    voice.gain.disconnect();
    voice.panner.disconnect();
  }

  private stopEngineVoices(): void {
    for (const slot of [...this.engineVoices.keys()]) {
      this.stopEngineVoice(slot);
    }
  }

  private readonly handleVisibilityChange = (): void => {
    const context = this.context;
    if (context === null) {
      return;
    }
    const token = ++this.transitionToken;
    this.visibilityOperation = this.visibilityOperation
      .catch(() => undefined)
      .then(async () => {
        if (token !== this.transitionToken || this.context !== context) {
          return;
        }
        if (document.hidden) {
          await context.suspend();
        } else {
          await context.resume();
        }
        if (token === this.transitionToken && this.context === context) {
          const nextState = context.state === "running" ? "running" : "suspended";
          this.setState(nextState);
          if (nextState === "running") {
            this.restoreContinuousState();
          }
        }
      })
      .catch(() => {
        if (token === this.transitionToken && this.context === context) {
          this.setState("error");
        }
      });
  };

  private async closeContext(): Promise<void> {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.stopDrawVoice();
    this.stopEngineVoices();
    const context = this.context;
    this.context = null;
    this.noiseBuffer = null;
    this.effectsGain?.disconnect();
    this.activityGain?.disconnect();
    this.engineGain?.disconnect();
    this.masterGain?.disconnect();
    this.compressor?.disconnect();
    this.effectsGain = null;
    this.activityGain = null;
    this.engineGain = null;
    this.masterGain = null;
    this.compressor = null;
    if (context !== null && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // Owned nodes and listeners are already disconnected.
      }
    }
  }

  private setState(state: AudioRuntimeState): void {
    if (this.runtimeState === state) {
      return;
    }
    this.runtimeState = state;
    this.onStateChange(state);
  }
}
