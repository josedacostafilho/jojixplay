import type { Body, BodyFrame } from "@jojixplay/game-sdk";

/** A rectangle of viewport pixels showing the whole camera frame, as `cameraCover` returns. */
interface Cover {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a player stands on screen: shoulder midpoint and shoulder width, in viewport pixels. */
export interface BodyAnchor {
  x: number;
  y: number;
  unit: number;
}

export interface AnchoredSpot {
  x: number;
  y: number;
  size: number;
}

export interface MenuLayout {
  card: AnchoredSpot;
  previous: AnchoredSpot;
  next: AnchoredSpot;
}

// Phone-tuning parameters, in shoulder widths. A relaxed arm must reach none of these spots and a
// deliberately stretched arm must reach each: overhead for the card, sideways for a bubble.
export const MENU_REACH = {
  cardRise: 1.5,
  cardSize: 1,
  sideReach: 1.75,
  bubbleSize: 0.8,
  minCardPx: 88,
  minBubblePx: 64,
  edgePx: 8,
} as const;

/** The player nearest the middle whose two shoulders are visible, mirrored onto the screen. */
export function findAnchor(
  frame: BodyFrame,
  cover: Cover,
): { body: Body; anchor: BodyAnchor } | null {
  let best: { body: Body; anchor: BodyAnchor; offset: number } | null = null;
  for (const body of frame.bodies) {
    const left = body.leftShoulder;
    const right = body.rightShoulder;
    if (!left || !right) continue;
    const middle = (left.x + right.x) / 2;
    const offset = Math.abs(middle - 0.5);
    if (best && best.offset <= offset) continue;
    best = {
      body,
      offset,
      anchor: {
        x: cover.left + (1 - middle) * cover.width,
        y: cover.top + ((left.y + right.y) / 2) * cover.height,
        unit: Math.hypot((left.x - right.x) * cover.width, (left.y - right.y) * cover.height),
      },
    };
  }
  return best && { body: best.body, anchor: best.anchor };
}

/** Places the game card above the head and one bubble at arm's length on each side. */
export function menuLayout(anchor: BodyAnchor, viewportWidth: number): MenuLayout {
  const { cardRise, cardSize, sideReach, bubbleSize, minCardPx, minBubblePx, edgePx } = MENU_REACH;
  const card = Math.max(anchor.unit * cardSize, minCardPx);
  const bubble = Math.max(anchor.unit * bubbleSize, minBubblePx);
  const inside = (x: number, size: number) =>
    Math.max(size / 2 + edgePx, Math.min(viewportWidth - size / 2 - edgePx, x));
  return {
    card: {
      x: inside(anchor.x, card),
      y: Math.max(anchor.y - anchor.unit * cardRise, card / 2 + edgePx),
      size: card,
    },
    previous: { x: inside(anchor.x - anchor.unit * sideReach, bubble), y: anchor.y, size: bubble },
    next: { x: inside(anchor.x + anchor.unit * sideReach, bubble), y: anchor.y, size: bubble },
  };
}
