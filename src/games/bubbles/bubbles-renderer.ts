import {
  BUBBLES_HAND_HIT_RADIUS,
  BUBBLES_POP_DURATION_MS,
  type BubbleSnapshot,
  type BubblesPlayerSide,
  type BubblesSnapshot,
} from "./bubbles-session";

const FULL_CIRCLE = Math.PI * 2;
const POP_PARTICLE_COUNT = 8;
const SINGLE_PLAYER_COLOR = "#5eead4";
const LEFT_PLAYER_COLOR = "#67e8f9";
const RIGHT_PLAYER_COLOR = "#fb7185";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function playerColor(side: BubblesPlayerSide, playerCount: 1 | 2): string {
  if (playerCount === 1) {
    return SINGLE_PLAYER_COLOR;
  }
  return side === "left" ? LEFT_PLAYER_COLOR : RIGHT_PLAYER_COLOR;
}

function drawBubbleBody(
  context: CanvasRenderingContext2D,
  bubble: BubbleSnapshot,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  scale: number,
  nowMs: number,
): void {
  const renderedRadius = radius * scale;
  const shimmer = bubble.shimmerPhase + nowMs * 0.00022;
  context.save();
  context.globalAlpha = alpha;
  context.shadowBlur = renderedRadius * 0.42;
  context.shadowColor = `hsla(${bubble.hue}, 90%, 72%, 0.28)`;

  const fill = context.createRadialGradient(
    x - renderedRadius * 0.28,
    y - renderedRadius * 0.34,
    renderedRadius * 0.06,
    x,
    y,
    renderedRadius,
  );
  fill.addColorStop(0, "rgba(255, 255, 255, 0.38)");
  fill.addColorStop(0.24, `hsla(${bubble.hue}, 95%, 78%, 0.13)`);
  fill.addColorStop(0.72, `hsla(${(bubble.hue + 70) % 360}, 90%, 68%, 0.08)`);
  fill.addColorStop(1, "rgba(255, 255, 255, 0.02)");
  context.fillStyle = fill;
  context.beginPath();
  context.arc(x, y, renderedRadius, 0, FULL_CIRCLE);
  context.fill();

  const rim = context.createLinearGradient(
    x - renderedRadius,
    y - renderedRadius,
    x + renderedRadius,
    y + renderedRadius,
  );
  rim.addColorStop(0, "rgba(255, 255, 255, 0.88)");
  rim.addColorStop(0.28, `hsla(${bubble.hue}, 100%, 78%, 0.82)`);
  rim.addColorStop(0.62, `hsla(${(bubble.hue + 105) % 360}, 100%, 72%, 0.8)`);
  rim.addColorStop(1, "rgba(255, 255, 255, 0.72)");
  context.strokeStyle = rim;
  context.lineWidth = Math.max(1.5, renderedRadius * 0.07);
  context.beginPath();
  context.arc(x, y, renderedRadius - context.lineWidth / 2, 0, FULL_CIRCLE);
  context.stroke();

  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255, 255, 255, 0.82)";
  context.lineCap = "round";
  context.lineWidth = Math.max(1.4, renderedRadius * 0.1);
  context.beginPath();
  context.arc(
    x,
    y,
    renderedRadius * 0.68,
    Math.PI * 1.03 + Math.sin(shimmer) * 0.12,
    Math.PI * 1.42 + Math.sin(shimmer) * 0.12,
  );
  context.stroke();

  context.strokeStyle = `hsla(${(bubble.hue + 145) % 360}, 100%, 76%, 0.52)`;
  context.lineWidth = Math.max(1, renderedRadius * 0.055);
  context.beginPath();
  context.arc(x, y, renderedRadius * 0.82, shimmer + 0.15, shimmer + Math.PI * 0.62);
  context.stroke();
  context.restore();
}

function drawPopEffect(
  context: CanvasRenderingContext2D,
  bubble: BubbleSnapshot,
  x: number,
  y: number,
  radius: number,
  progress: number,
  playerCount: 1 | 2,
): void {
  const eased = easeOutCubic(progress);
  for (let index = 0; index < POP_PARTICLE_COUNT; index += 1) {
    const angle = bubble.shimmerPhase + (index / POP_PARTICLE_COUNT) * FULL_CIRCLE;
    const distance = radius * (0.35 + eased * (1.25 + (index % 3) * 0.18));
    const particleRadius = Math.max(0.5, radius * 0.09 * (1 - progress));
    context.save();
    context.globalAlpha = 1 - progress;
    context.fillStyle = `hsla(${(bubble.hue + index * 19) % 360}, 100%, 78%, 0.85)`;
    context.beginPath();
    context.arc(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance + eased * radius * 0.22,
      particleRadius,
      0,
      FULL_CIRCLE,
    );
    context.fill();
    context.restore();
  }

  context.save();
  context.globalAlpha = 1 - progress;
  context.fillStyle = playerColor(bubble.poppedBy ?? "right", playerCount);
  context.font = `800 ${Math.max(14, radius * 0.62)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("+1", x, y - radius * (0.45 + eased * 0.9));
  context.restore();
}

export function drawBubbles(
  context: CanvasRenderingContext2D,
  snapshot: BubblesSnapshot,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  const minimumDimension = Math.min(width, height);

  for (const bubble of snapshot.bubbles) {
    const x = bubble.point.x * width;
    const y = bubble.point.y * height;
    const radius = bubble.radius * minimumDimension;
    const spawnProgress = clamp((snapshot.nowMs - bubble.spawnedAtMs) / 220, 0, 1);
    if (bubble.state === "popping" && bubble.poppedAtMs !== null) {
      const popProgress = clamp(
        (snapshot.nowMs - bubble.poppedAtMs) / BUBBLES_POP_DURATION_MS,
        0,
        1,
      );
      drawBubbleBody(
        context,
        bubble,
        x,
        y,
        radius,
        1 - popProgress,
        1 + easeOutCubic(popProgress) * 0.28,
        snapshot.nowMs,
      );
      drawPopEffect(context, bubble, x, y, radius, popProgress, snapshot.playerCount);
      continue;
    }
    drawBubbleBody(
      context,
      bubble,
      x,
      y,
      radius,
      easeOutCubic(spawnProgress),
      0.72 + easeOutCubic(spawnProgress) * 0.28,
      snapshot.nowMs,
    );
  }

  const handRadius = BUBBLES_HAND_HIT_RADIUS * minimumDimension;
  const visibleHands =
    snapshot.phase === "starting" || snapshot.phase === "playing" ? snapshot.hands : [];
  for (const hand of visibleHands) {
    const x = hand.point.x * width;
    const y = hand.point.y * height;
    const color = playerColor(hand.side, snapshot.playerCount);
    context.save();
    context.strokeStyle = color;
    context.lineWidth = Math.max(3, minimumDimension * 0.005);
    context.shadowBlur = handRadius * 0.75;
    context.shadowColor = color;
    context.beginPath();
    context.arc(x, y, handRadius, 0, FULL_CIRCLE);
    context.stroke();
    context.strokeStyle = "rgba(255, 255, 255, 0.82)";
    context.lineWidth = Math.max(1.5, minimumDimension * 0.002);
    context.beginPath();
    context.arc(x, y, handRadius * 0.68, 0, FULL_CIRCLE);
    context.stroke();
    context.restore();
  }
}
