import { describe, expect, it } from "vitest";
import { DRAW_COLORS, DRAW_TOOL_DWELL_MS, DrawSession } from "../../src/games/draw/draw-session";
import type { PoseControlHands, PoseControlTarget } from "../../src/interaction/pose-controls";
import type { Point, Size } from "../../src/render/geometry";

const FRAME: Size = { width: 1_280, height: 720 };
const VIEWPORT: Size = { width: 1_280, height: 720 };
const NO_TARGETS: readonly PoseControlTarget<"toolbar">[] = [];

function hands(
  left: Point | null,
  right: Point | null = null,
  selected: "left" | "right" = "left",
): PoseControlHands {
  return { selected, left, right };
}

function update(
  session: DrawSession,
  nowMs: number,
  visibleHands: PoseControlHands | null,
  options: {
    frame?: Size;
    targets?: readonly PoseControlTarget<"toolbar">[];
    viewport?: Size;
  } = {},
) {
  return session.update({
    hands: visibleHands,
    frame: options.frame ?? FRAME,
    viewport: options.viewport ?? VIEWPORT,
    targets: options.targets ?? NO_TARGETS,
    nowMs,
  });
}

function engageBrush(session: DrawSession, point: Point = { x: 0.4, y: 0.5 }) {
  update(session, 0, hands(point));
  update(session, 200, hands(point));
  update(session, 400, hands(point));
  return update(session, DRAW_TOOL_DWELL_MS, hands(point));
}

describe("Draw session", () => {
  it("dwell-engages, draws normalized unmirrored segments, and dwell-lifts after movement", () => {
    const session = new DrawSession();
    session.setEnabled(true, 0);

    const arming = update(session, 0, hands({ x: 0.4, y: 0.5 }));
    expect(arming.brush).toMatchObject({ phase: "arming", dwellProgress: 0 });
    update(session, 200, hands({ x: 0.4, y: 0.5 }));
    update(session, 400, hands({ x: 0.4, y: 0.5 }));
    const engaged = update(session, 500, hands({ x: 0.4, y: 0.5 }));
    expect(engaged.activeTool).toBe("brush");
    expect(engaged.commands).toEqual([
      {
        tool: "brush",
        color: DRAW_COLORS[0],
        from: { x: 0.4, y: 0.5 },
        to: { x: 0.4, y: 0.5 },
      },
    ]);

    const moved = update(session, 550, hands({ x: 0.45, y: 0.5 }));
    expect(moved.activeTool).toBe("brush");
    expect(moved.commands).toHaveLength(2);
    expect(moved.commands[1]?.to.x).toBeGreaterThan(0.4);
    expect(moved.commands[1]?.to.x).toBeLessThan(0.45);

    update(session, 750, hands({ x: 0.45, y: 0.5 }));
    update(session, 950, hands({ x: 0.45, y: 0.5 }));
    const lifted = update(session, 1_050, hands({ x: 0.45, y: 0.5 }));
    expect(lifted.activeTool).toBeNull();
    expect(lifted.brush.phase).toBe("hover");
    expect(lifted.commands.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the opposite hand as the eraser and allows only one engaged tool", () => {
    const session = new DrawSession();
    session.setEnabled(true, 0);
    engageBrush(session);

    update(session, 600, hands({ x: 0.43, y: 0.5 }, { x: 0.6, y: 0.5 }));
    update(session, 800, hands({ x: 0.45, y: 0.5 }, { x: 0.6, y: 0.5 }));
    update(session, 1_000, hands({ x: 0.46, y: 0.5 }, { x: 0.6, y: 0.5 }));
    const erased = update(session, 1_100, hands({ x: 0.47, y: 0.5 }, { x: 0.6, y: 0.5 }));

    expect(erased.activeTool).toBe("eraser");
    expect(erased.brush.phase).not.toBe("active");
    expect(erased.eraser.phase).toBe("active");
    expect(erased.commands.at(-1)).toMatchObject({
      tool: "eraser",
      from: { x: 0.6, y: 0.5 },
      to: { x: 0.6, y: 0.5 },
    });
  });

  it("lifts and breaks paths at the toolbar, frame bounds, stale input, jumps, and frame changes", () => {
    const session = new DrawSession();
    session.setEnabled(true, 0);
    engageBrush(session);
    const moved = update(session, 550, hands({ x: 0.45, y: 0.5 }));
    const commandCount = moved.commands.length;
    const toolbar: readonly PoseControlTarget<"toolbar">[] = [
      {
        action: "toolbar",
        label: "Toolbar",
        dwellMs: 900,
        rect: { x: 690, y: 300, width: 180, height: 120 },
      },
    ];

    const blocked = update(session, 600, hands({ x: 0.4, y: 0.5 }), {
      targets: toolbar,
    });
    expect(blocked.activeTool).toBeNull();
    expect(blocked.commands).toHaveLength(commandCount);

    expect(update(session, 650, hands({ x: -0.01, y: 0.5 })).brush.phase).toBe("unavailable");
    update(session, 700, hands({ x: 0.4, y: 0.5 }));
    update(session, 1_200, hands({ x: 0.4, y: 0.5 }));
    const beforeJump = session.tick(1_200).commands.length;
    const jumped = update(session, 1_220, hands({ x: 0.6, y: 0.5 }));
    expect(jumped.activeTool).toBeNull();
    expect(jumped.commands).toHaveLength(beforeJump);

    const resizedFrame = update(session, 1_250, hands({ x: 0.6, y: 0.5 }), {
      frame: { width: 640, height: 480 },
    });
    expect(resizedFrame.activeTool).toBeNull();
    expect(resizedFrame.commands).toHaveLength(beforeJump);

    expect(update(session, 1_300, null).brush.phase).toBe("unavailable");
    update(session, 1_400, hands({ x: 0.4, y: 0.5 }), {
      frame: { width: 640, height: 480 },
    });
    expect(session.tick(1_651).brush.phase).toBe("unavailable");
  });

  it("retains artwork and color across navigation, then clears atomically", () => {
    const session = new DrawSession();
    session.setEnabled(true, 0);
    const drawn = engageBrush(session);
    expect(drawn.commands).toHaveLength(1);

    const disabled = session.setEnabled(false, 600);
    expect(disabled.activeTool).toBeNull();
    expect(disabled.commands).toHaveLength(1);
    const colored = session.cycleColor(650);
    expect(colored.color).toBe(DRAW_COLORS[1]);
    expect(colored.commands).toHaveLength(1);
    const restored = session.setEnabled(true, 700);
    expect(restored.color).toBe(DRAW_COLORS[1]);
    expect(restored.commands).toHaveLength(1);

    const cleared = session.clear(750);
    expect(cleared.commands).toHaveLength(0);
    expect(cleared.generation).toBe(1);
    expect(cleared.revision).toBeGreaterThan(drawn.revision);
  });

  it("maps the selected right hand to the brush and its left hand to the eraser", () => {
    const session = new DrawSession();
    session.setEnabled(true, 0);
    const visibleHands = hands({ x: 0.3, y: 0.6 }, { x: 0.7, y: 0.4 }, "right");
    update(session, 0, visibleHands);
    update(session, 200, visibleHands);
    update(session, 400, visibleHands);
    const engaged = update(session, 500, visibleHands);

    expect(engaged.activeTool).toBe("brush");
    expect(engaged.commands[0]).toMatchObject({
      tool: "brush",
      from: { x: 0.7, y: 0.4 },
    });
    expect(engaged.eraser.point).toEqual({ x: 0.3, y: 0.6 });
  });
});
