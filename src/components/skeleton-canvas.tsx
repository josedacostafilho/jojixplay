import { useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import { drawSkeleton } from "../render/skeleton";

interface SkeletonCanvasProps {
  packet: PosePacket | null;
  label: string;
  className?: string;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function SkeletonCanvas({ packet, label, className }: SkeletonCanvasProps) {
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
      drawSkeleton(context, packet, size.width, size.height);
    }
  }, [packet, size]);

  return (
    <canvas ref={canvasRef} class={className} role="img" aria-label={label}>
      {label}
    </canvas>
  );
}
