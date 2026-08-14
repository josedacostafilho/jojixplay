import { describe, expect, it } from "vitest";
import {
  DRAW_COLORS,
  DRAW_GRIP_ENGAGE_SHOULDER_RATIO,
  DRAW_GRIP_RELEASE_SHOULDER_RATIO,
  DrawSession,
} from "../../src/games/draw/draw-session";
import type { PoseControlHands, PoseControlTarget } from "../../src/interaction/pose-controls";
import type { Point, Size } from "../../src/render/geometry";

const FRAME: Size = { width: 1_280, height: 720 };
const VIEWPORT: Size = { width: 1_280, height: 720 };
const SHOULDER_SPAN = 0.36;
const NO_TARGETS: readonly PoseControlTarget<"toolbar">[] = [];

function hands(
  left: Point | null,
  right: Point | null,
  selected: "left" | "right" = "left",
  shoulderSpan = SHOULDER_SPAN,
): PoseControlHands {
  return { selected, left, right, shoulderSpan };
}

function update(
  session: DrawSession,
  nowMs: number,
  visibleHands: PoseControlHands | null,
  options: {
    frame?: Size;
    sampleAtMs?: number;
    targets?: readonly PoseControlTarget<"toolbar">[];
    viewport?: Size;
  } = {},
) {
  return session.update({
    hands: visibleHands,
    frame: options.frame ?? FRAME,
    viewport: options.viewport ?? VIEWPORT,
    targets: options.targets ?? NO_TARGETS,
    sampleAtMs: options.sampleAtMs ?? nowMs,
    receivedAtMs: nowMs,
  });
}

function supportingPointAtRatio(main: Point, ratio: number): Point {
  return {
    x: main.x + (ratio * SHOULDER_SPAN * Math.min(FRAME.width, FRAME.height)) / FRAME.width,
    y: main.y,
  };
}

function engagePencil(session: DrawSession, main: Point = { x: 0.4, y: 0.5 }) {
  return update(
    session,
    0,
    hands(main, supportingPointAtRatio(main, DRAW_GRIP_ENGAGE_SHOULDER_RATIO)),
  );
}

describe("Draw session", () => {
  it("engages immediately with a book-width grip, draws from the main hand, and releases wide", () => {
    const session = new DrawSession();
    session.setEnabled(true);

    const engaged = engagePencil(session);
    expect(engaged).toMatchObject({
      selectedTool: "pencil",
      gripActive: true,
      cursor: { phase: "active", point: { x: 0.4, y: 0.5 } },
    });
    expect(engaged.commands).toEqual([
      {
        tool: "pencil",
        color: DRAW_COLORS[0],
        from: { x: 0.4, y: 0.5 },
        to: { x: 0.4, y: 0.5 },
      },
    ]);

    const movedMain = { x: 0.45, y: 0.5 };
    const continued = update(session, 50, hands(movedMain, supportingPointAtRatio(movedMain, 1)));
    expect(continued.gripActive).toBe(true);
    expect(continued.commands).toHaveLength(2);
    expect(continued.commands[1]?.to.x).toBeGreaterThan(0.4);
    expect(continued.commands[1]?.to.x).toBeLessThan(0.45);

    const commandCount = continued.commands.length;
    const released = update(
      session,
      100,
      hands(movedMain, supportingPointAtRatio(movedMain, DRAW_GRIP_RELEASE_SHOULDER_RATIO)),
    );
    expect(released.gripActive).toBe(false);
    expect(released.cursor.phase).toBe("ready");
    expect(released.commands).toHaveLength(commandCount);
  });

  it("uses separate inclusive engagement and release thresholds with a wide hysteresis band", () => {
    const session = new DrawSession();
    session.setEnabled(true);
    const main = { x: 0.4, y: 0.5 };

    expect(
      update(
        session,
        0,
        hands(main, supportingPointAtRatio(main, DRAW_GRIP_ENGAGE_SHOULDER_RATIO + 0.01)),
      ).gripActive,
    ).toBe(false);
    expect(
      update(
        session,
        10,
        hands(main, supportingPointAtRatio(main, DRAW_GRIP_ENGAGE_SHOULDER_RATIO)),
      ).gripActive,
    ).toBe(true);
    expect(update(session, 20, hands(main, supportingPointAtRatio(main, 1.1))).gripActive).toBe(
      true,
    );
    expect(
      update(
        session,
        30,
        hands(main, supportingPointAtRatio(main, DRAW_GRIP_RELEASE_SHOULDER_RATIO - 0.01)),
      ).gripActive,
    ).toBe(true);
    expect(
      update(
        session,
        40,
        hands(main, supportingPointAtRatio(main, DRAW_GRIP_RELEASE_SHOULDER_RATIO)),
      ).gripActive,
    ).toBe(false);
  });

  it("uses the selected main hand for both pencil and eraser modes", () => {
    const session = new DrawSession();
    session.setEnabled(true);
    const rightMain = { x: 0.6, y: 0.45 };
    const leftSupport = supportingPointAtRatio(rightMain, -DRAW_GRIP_ENGAGE_SHOULDER_RATIO);

    const penciled = update(session, 0, hands(leftSupport, rightMain, "right"));
    expect(penciled.commands[0]).toMatchObject({
      tool: "pencil",
      from: rightMain,
      to: rightMain,
    });

    const selected = session.cycleTool();
    expect(selected).toMatchObject({ selectedTool: "eraser", gripActive: true });
    const nextMain = { x: 0.61, y: 0.45 };
    const erased = update(
      session,
      50,
      hands(supportingPointAtRatio(nextMain, -1), nextMain, "right"),
    );
    expect(erased.commands.at(-1)).toMatchObject({
      tool: "eraser",
      from: erased.cursor.point,
      to: erased.cursor.point,
    });
    expect(erased.commands.at(-1)?.from).not.toEqual(leftSupport);
  });

  it("keeps the grip through supporting-hand dropout and path-breaking drawing boundaries", () => {
    const session = new DrawSession();
    session.setEnabled(true);
    engagePencil(session);

    const withoutSupport = update(session, 40, hands({ x: 0.41, y: 0.5 }, null));
    expect(withoutSupport.gripActive).toBe(true);
    expect(withoutSupport.commands).toHaveLength(2);

    const toolbar: readonly PoseControlTarget<"toolbar">[] = [
      {
        action: "toolbar",
        label: "Toolbar",
        dwellMs: 900,
        rect: { x: 740, y: 320, width: 55, height: 80 },
      },
    ];
    const beforeToolbar = withoutSupport.commands.length;
    const blocked = update(session, 80, hands({ x: 0.4, y: 0.5 }, { x: 0.5, y: 0.5 }), {
      targets: toolbar,
    });
    expect(blocked.gripActive).toBe(true);
    expect(blocked.commands).toHaveLength(beforeToolbar);

    const resumed = update(session, 120, hands({ x: 0.35, y: 0.5 }, { x: 0.55, y: 0.5 }), {
      targets: toolbar,
    });
    expect(resumed.gripActive).toBe(true);
    expect(resumed.commands).toHaveLength(beforeToolbar + 1);

    const outside = update(session, 160, hands({ x: -0.01, y: 0.5 }, { x: 0.2, y: 0.5 }));
    expect(outside.gripActive).toBe(true);
    expect(outside.cursor.phase).toBe("unavailable");
    const returned = update(session, 200, hands({ x: 0.3, y: 0.5 }, { x: 0.5, y: 0.5 }));
    expect(returned.gripActive).toBe(true);
    expect(returned.commands).toHaveLength(beforeToolbar + 2);

    const beforeJump = returned.commands.length;
    const jumped = update(session, 240, hands({ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }));
    expect(jumped.gripActive).toBe(true);
    expect(jumped.commands).toHaveLength(beforeJump);
    const afterJump = update(session, 280, hands({ x: 0.51, y: 0.5 }, { x: 0.71, y: 0.5 }));
    expect(afterJump.gripActive).toBe(true);
    expect(afterJump.commands).toHaveLength(beforeJump + 1);
  });

  it("fails closed across stale pose input and camera-dimension changes", () => {
    const session = new DrawSession();
    session.setEnabled(true);
    engagePencil(session);

    expect(session.tick(250).gripActive).toBe(true);
    expect(session.tick(251)).toMatchObject({
      gripActive: false,
      cursor: { phase: "unavailable", point: null },
    });

    engagePencil(session);
    const resized = update(session, 100, hands({ x: 0.4, y: 0.5 }, { x: 0.5, y: 0.5 }), {
      frame: { width: 640, height: 480 },
    });
    expect(resized).toMatchObject({
      gripActive: false,
      cursor: { phase: "unavailable", point: null },
    });
  });

  it("requires both hands and a valid shoulder span to begin a grip", () => {
    const session = new DrawSession();
    session.setEnabled(true);
    const main = { x: 0.4, y: 0.5 };
    const support = { x: 0.5, y: 0.5 };

    expect(update(session, 0, hands(main, null)).gripActive).toBe(false);
    expect(update(session, 10, hands(main, support, "left", 0)).gripActive).toBe(false);
    expect(update(session, 20, hands(main, support, "left", Number.NaN)).gripActive).toBe(false);
  });

  it("retains artwork, color, and selected tool across navigation while resetting the grip", () => {
    const session = new DrawSession();
    session.setEnabled(true);
    const drawn = engagePencil(session);
    expect(drawn.commands).toHaveLength(1);

    const erased = session.cycleTool();
    expect(erased).toMatchObject({ selectedTool: "eraser", gripActive: true });
    const colored = session.cycleColor();
    expect(colored.color).toBe(DRAW_COLORS[1]);
    expect(colored.gripActive).toBe(true);

    const disabled = session.setEnabled(false);
    expect(disabled.gripActive).toBe(false);
    expect(disabled.commands).toHaveLength(1);
    const restored = session.setEnabled(true);
    expect(restored).toMatchObject({
      selectedTool: "eraser",
      color: DRAW_COLORS[1],
      gripActive: false,
    });
    expect(restored.commands).toHaveLength(1);

    engagePencil(session);
    const cleared = session.clear();
    expect(cleared.commands).toHaveLength(0);
    expect(cleared.generation).toBe(1);
    expect(cleared.gripActive).toBe(true);
  });
});
