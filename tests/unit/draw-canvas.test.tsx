import { cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawCanvas } from "../../src/games/draw/draw-canvas";
import type { DrawSnapshot } from "../../src/games/draw/draw-session";

class ImmediateResizeObserver {
  public constructor(private readonly callback: ResizeObserverCallback) {}

  public observe(): void {
    this.callback(
      [{ contentRect: { width: 1_000, height: 500 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  public unobserve(): void {}

  public disconnect(): void {}
}

function drawing(generation = 0, commands: DrawSnapshot["commands"] = []): DrawSnapshot {
  return {
    color: "#111827",
    colorIndex: 0,
    commands,
    generation,
    revision: commands.length,
    activeTool: null,
    brush: { point: null, phase: "unavailable", dwellProgress: 0 },
    eraser: { point: null, phase: "unavailable", dwellProgress: 0 },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Draw canvas", () => {
  it("mirrors normalized brush and eraser commands and clears on a new generation", async () => {
    vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
    const compositeOperations: string[] = [];
    const context = {
      arc: vi.fn(),
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(context, "globalCompositeOperation", {
      configurable: true,
      set: (operation: GlobalCompositeOperation) => compositeOperations.push(operation),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context);

    const commands: DrawSnapshot["commands"] = [
      {
        tool: "brush",
        color: "#2563eb",
        from: { x: 0.2, y: 0.3 },
        to: { x: 0.4, y: 0.5 },
      },
      {
        tool: "eraser",
        color: "#2563eb",
        from: { x: 0.6, y: 0.7 },
        to: { x: 0.6, y: 0.7 },
      },
    ];
    const view = render(<DrawCanvas drawing={drawing(0, commands)} />);

    await waitFor(() => expect(context.stroke).toHaveBeenCalledOnce());
    expect(context.moveTo).toHaveBeenCalledWith(800, 150);
    expect(context.lineTo).toHaveBeenCalledWith(600, 250);
    expect(context.arc).toHaveBeenCalledWith(400, 350, 17.5, 0, Math.PI * 2);
    expect(compositeOperations).toEqual(["source-over", "destination-out"]);
    expect(context.clearRect).toHaveBeenCalledOnce();

    view.rerender(<DrawCanvas drawing={drawing(1)} />);
    await waitFor(() => expect(context.clearRect).toHaveBeenCalledTimes(2));
  });
});
