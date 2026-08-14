import { useEffect, useRef, useState } from "preact/hooks";
import { drawBubbles } from "./bubbles-renderer";
import type { BubblesSnapshot } from "./bubbles-session";

interface BubblesCanvasProps {
  snapshot: BubblesSnapshot;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function BubblesCanvas({ snapshot }: BubblesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      setSize({
        width: Math.max(1, Math.round(entry.contentRect.width * dpr)),
        height: Math.max(1, Math.round(entry.contentRect.height * dpr)),
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || size.width === 0 || size.height === 0) {
      return;
    }
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    const context = canvas.getContext("2d");
    if (context !== null) {
      drawBubbles(context, snapshot, size.width, size.height);
    }
  }, [snapshot, size]);

  return (
    <canvas ref={canvasRef} class="bubbles-canvas" role="img" aria-label="Bubbles game arena">
      Bubbles game arena
    </canvas>
  );
}
