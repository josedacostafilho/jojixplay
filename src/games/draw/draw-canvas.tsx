import { useEffect, useRef, useState } from "preact/hooks";
import {
  DRAW_BRUSH_WIDTH,
  DRAW_ERASER_WIDTH,
  type DrawCommand,
  type DrawSnapshot,
} from "./draw-session";

interface DrawCanvasProps {
  drawing: DrawSnapshot;
}

interface CanvasSize {
  width: number;
  height: number;
}

function drawCommand(
  context: CanvasRenderingContext2D,
  command: DrawCommand,
  width: number,
  height: number,
): void {
  const minimumDimension = Math.min(width, height);
  const lineWidth =
    minimumDimension * (command.tool === "brush" ? DRAW_BRUSH_WIDTH : DRAW_ERASER_WIDTH);
  const from = { x: (1 - command.from.x) * width, y: command.from.y * height };
  const to = { x: (1 - command.to.x) * width, y: command.to.y * height };
  context.save();
  context.globalCompositeOperation = command.tool === "brush" ? "source-over" : "destination-out";
  context.strokeStyle = command.color;
  context.fillStyle = command.color;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (from.x === to.x && from.y === to.y) {
    context.beginPath();
    context.arc(from.x, from.y, lineWidth / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }
  context.restore();
}

export function DrawCanvas({ drawing }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedGenerationRef = useRef(-1);
  const renderedCommandCountRef = useRef(0);
  const renderedSizeRef = useRef<CanvasSize>({ width: 0, height: 0 });
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
    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }

    const sizeChanged =
      renderedSizeRef.current.width !== size.width ||
      renderedSizeRef.current.height !== size.height;
    const mustReplay = sizeChanged || renderedGenerationRef.current !== drawing.generation;
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    if (mustReplay) {
      context.clearRect(0, 0, size.width, size.height);
      renderedCommandCountRef.current = 0;
    }
    for (let index = renderedCommandCountRef.current; index < drawing.commands.length; index += 1) {
      const command = drawing.commands[index];
      if (command !== undefined) {
        drawCommand(context, command, size.width, size.height);
      }
    }
    renderedCommandCountRef.current = drawing.commands.length;
    renderedGenerationRef.current = drawing.generation;
    renderedSizeRef.current = size;
  }, [drawing.commands, drawing.generation, drawing.revision, size]);

  return (
    <canvas ref={canvasRef} class="draw-canvas" role="img" aria-label="Your Draw artwork">
      Your Draw artwork
    </canvas>
  );
}
