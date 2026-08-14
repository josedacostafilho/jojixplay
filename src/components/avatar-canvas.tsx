import { useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import { type AvatarAppearance, drawAvatar } from "../render/avatar";
import { AvatarPresentationSession } from "../render/avatar-presentation";

interface AvatarCanvasProps {
  packet: PosePacket | null;
  label: string;
  appearance: AvatarAppearance;
  className?: string;
  mirrored?: boolean;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function AvatarCanvas({
  packet,
  label,
  appearance,
  className,
  mirrored = false,
}: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [presentationSession] = useState(() => new AvatarPresentationSession());
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

    const presentation = presentationSession.update(packet);
    const animationFrameId = window.requestAnimationFrame(() => {
      drawAvatar(context, presentation, size.width, size.height, {
        mirrored,
        appearance,
      });
    });
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [packet, size, mirrored, appearance, presentationSession]);

  return (
    <canvas ref={canvasRef} class={className} role="img" aria-label={label}>
      {label}
    </canvas>
  );
}
