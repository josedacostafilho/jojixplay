import type { Frame } from "@jojixplay/game-sdk";

type Listener = (frame: Frame | null) => void;

/**
 * Sensed frames arrive at camera rate. Consumers read or subscribe here instead of receiving them
 * as component state, so a frame never rerenders the interface. `latest` may be stale: consumers
 * apply their own freshness limit.
 */
export interface FrameSource {
  latest(): Frame | null;
  subscribe(listener: Listener): () => void;
}

export class FrameChannel implements FrameSource {
  private frame: Frame | null = null;
  private readonly listeners = new Set<Listener>();

  public latest(): Frame | null {
    return this.frame;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(frame: Frame | null): void {
    if (frame === null && this.frame === null) {
      return;
    }
    this.frame = frame;
    for (const listener of this.listeners) {
      listener(frame);
    }
  }
}
