export type SoundName = "turn" | "select" | "back";

// Each sound is a short run of notes: [frequency in Hz, start offset in seconds].
const NOTES: Readonly<Record<SoundName, readonly (readonly [number, number])[]>> = {
  turn: [[520, 0]],
  select: [
    [660, 0],
    [990, 0.09],
  ],
  back: [
    [440, 0],
    [330, 0.09],
  ],
};
const NOTE_SECONDS = 0.12;
const VOLUME = 0.18;

/** Synthesized interface sounds. No audio files, no microphone; silent where audio is unavailable. */
export class Sounds {
  private context: AudioContext | null = null;

  /** Must be called from a trusted activation, as browsers require before audio can play. */
  public start(): void {
    if (this.context !== null || typeof AudioContext === "undefined") return;
    try {
      this.context = new AudioContext();
    } catch {
      // Audio is an enhancement; play continues without it.
    }
  }

  public play(name: SoundName): void {
    const context = this.context;
    if (context === null || context.state !== "running") return;
    for (const [frequency, offset] of NOTES[name]) {
      const at = context.currentTime + offset;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(VOLUME, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + NOTE_SECONDS);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + NOTE_SECONDS);
    }
  }

  public stop(): void {
    const context = this.context;
    this.context = null;
    void context?.close().catch(() => undefined);
  }
}
