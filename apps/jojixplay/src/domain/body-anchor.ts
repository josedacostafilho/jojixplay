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
  /** The middle of the three game cards. Its neighbours sit `spacing` to each side. */
  card: AnchoredSpot;
  spacing: number;
  /** How far each end preview's centre is from the middle card's. */
  peekOffset: number;
  previous: AnchoredSpot;
  next: AnchoredSpot;
}

// Phone-tuning parameters. Distances are in shoulder widths, so the same arm movement works for a
// child and an adult: a relaxed arm must reach none of these spots and a deliberately stretched
// arm must reach each, overhead for a card and sideways for a bubble. Sizes also follow the body
// but only between a floor, so a far player still sees them, and a ceiling given as a share of the
// screen height, so a near player on a television does not get enormous buttons.
export const MENU_REACH = {
  cardRise: 1.5,
  cardSize: 1,
  sideReach: 1.75,
  bubbleSize: 0.8,
  minCardPx: 88,
  minBubblePx: 64,
  maxCardHeightShare: 0.3,
  maxBubbleHeightShare: 0.24,
  /** The gap between neighbouring cards, and between the card row and a bubble, in card sizes. */
  gap: 0.12,
  /** An end preview's size, in card sizes. */
  peekSize: 0.6,
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

/**
 * Places three game cards in a row above the head, a small preview at each end of the row, and
 * one bubble at arm's length on each side. The bubbles belong at shoulder height; when the
 * shoulders are so high on screen that the row has stopped at the top edge, the bubbles slide down
 * to stay clear of it instead of crowding into it.
 */
export function menuLayout(
  anchor: BodyAnchor,
  viewportWidth: number,
  viewportHeight: number,
): MenuLayout {
  const reach = MENU_REACH;
  // Five slots must fit across the screen however small it is.
  const rowUnits = 3 + 2 * reach.peekSize + 4 * reach.gap;
  const card = Math.min(
    Math.max(anchor.unit * reach.cardSize, reach.minCardPx),
    viewportHeight * reach.maxCardHeightShare,
    (viewportWidth - 2 * reach.edgePx) / rowUnits,
  );
  const bubble = Math.min(
    Math.max(anchor.unit * reach.bubbleSize, reach.minBubblePx),
    viewportHeight * reach.maxBubbleHeightShare,
  );
  const spacing = card * (1 + reach.gap);
  const peekOffset = spacing + card * (0.5 + reach.gap + reach.peekSize / 2);
  const halfRow = (card * rowUnits) / 2;
  const inside = (x: number, half: number) =>
    Math.max(half + reach.edgePx, Math.min(viewportWidth - half - reach.edgePx, x));
  const cardY = Math.max(anchor.y - anchor.unit * reach.cardRise, card / 2 + reach.edgePx);
  const bubbleY = Math.min(
    Math.max(anchor.y, cardY + card / 2 + card * reach.gap + bubble / 2),
    viewportHeight - bubble / 2 - reach.edgePx,
  );
  return {
    card: { x: inside(anchor.x, halfRow), y: cardY, size: card },
    spacing,
    peekOffset,
    previous: {
      x: inside(anchor.x - anchor.unit * reach.sideReach, bubble / 2),
      y: bubbleY,
      size: bubble,
    },
    next: {
      x: inside(anchor.x + anchor.unit * reach.sideReach, bubble / 2),
      y: bubbleY,
      size: bubble,
    },
  };
}
