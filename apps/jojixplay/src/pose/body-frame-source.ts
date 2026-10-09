import type { BodyFrame } from "@jojixplay/game-sdk";

type Listener = (frame: BodyFrame | null) => void;

/**
 * Pose frames arrive at camera rate. Consumers read or subscribe here instead of receiving them
 * as component state, so a frame never rerenders the interface. `latest` may be stale: consumers
 * apply their own freshness limit.
 */
export interface BodyFrameSource {
  latest(): BodyFrame | null;
  subscribe(listener: Listener): () => void;
}

export class BodyFrameChannel implements BodyFrameSource {
  private frame: BodyFrame | null = null;
  private readonly listeners = new Set<Listener>();

  public latest(): BodyFrame | null {
    return this.frame;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publish(frame: BodyFrame | null): void {
    if (frame === null && this.frame === null) {
      return;
    }
    this.frame = frame;
    for (const listener of this.listeners) {
      listener(frame);
    }
  }
}
