import { useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import { drawSkeleton, SKELETON_PALETTE, type SkeletonPalette } from "../render/skeleton";

interface SkeletonCanvasProps {
  packet: PosePacket | null;
  label: string;
  className?: string;
  mirrored?: boolean;
  palette?: SkeletonPalette;
  opacity?: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function SkeletonCanvas({
  packet,
  label,
  className,
  mirrored = false,
  palette = SKELETON_PALETTE,
  opacity = 1,
}: SkeletonCanvasProps) {
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
    if (context === null) {
      return;
    }

    let animationFrameId: number | null = null;
    const render = () => {
      drawSkeleton(context, packet, size.width, size.height, {
        mirrored,
        palette,
        opacity,
      });
    };
    animationFrameId = window.requestAnimationFrame(render);
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [packet, size, mirrored, palette, opacity]);

  return (
    <canvas ref={canvasRef} class={className} role="img" aria-label={label}>
      {label}
    </canvas>
  );
}
