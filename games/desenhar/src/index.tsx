import {
  type BodyFrame,
  type ControlPoint,
  type Experience,
  type GameHost,
  isFresh,
  mountMovementControls,
} from "@jojixplay/game-sdk";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { createPaint } from "./paint";
import { type Brush, colorNames, colors, DrawSession, type Point } from "./session";
import "./style.css";

type DialogMode = "clear" | "exit";

function Confirm({
  title,
  body,
  stay,
  leave,
  onStay,
  onLeave,
}: {
  title: string;
  body: string;
  stay: string;
  leave: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} class="draw-dialog" onCancel={onStay}>
      <h2>{title}</h2>
      <p>{body}</p>
      <button type="button" onClick={onStay}>
        {stay}
      </button>
      <button type="button" onClick={onLeave}>
        {leave}
      </button>
    </dialog>
  );
}

function Palette({
  brush,
  player,
  players,
  onTool,
}: {
  brush: Brush;
  player: number;
  players: 1 | 2;
  onTool: (player: number, action: string) => void;
}) {
  const side = players === 1 ? "" : player === 0 ? " · esquerda" : " · direita";
  const tools = [
    ["size", brush.thick ? "●" : "•", brush.thick ? "Pincel grosso" : "Pincel fino"],
    ["hand", "✋", brush.leftHand ? "Pintar com a mão esquerda" : "Pintar com a mão direita"],
    ["undo", "↶", "Desfazer"],
  ] as const;
  return (
    <div class="draw-palette" data-player={player}>
      <span class="draw-player">
        {players === 1 ? "Suas cores" : player === 0 ? "Lado esquerdo" : "Lado direito"}
      </span>
      {colors.map((color, index) => (
        <button
          key={color}
          type="button"
          class="draw-color"
          style={{ "--paint": color }}
          aria-label={`${colorNames[index]}${side}`}
          aria-pressed={brush.color === index}
          onClick={() => onTool(player, `color-${index}`)}
        >
          <span aria-hidden="true">✓</span>
        </button>
      ))}
      {tools.map(([action, icon, label]) => (
        <button
          key={action}
          type="button"
          aria-label={`${label}${side}`}
          title={label}
          onClick={() => onTool(player, action)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function DrawUI({
  session,
  dialog,
  hint,
  onTool,
  onDialog,
  onClear,
  onExit,
}: {
  session: DrawSession;
  dialog: DialogMode | null;
  hint: string;
  onTool: (player: number, action: string) => void;
  onDialog: (mode: DialogMode | null) => void;
  onClear: () => void;
  onExit: () => void;
}) {
  return (
    <>
      <div class="draw-heading">
        <span>✦ ATELIÊ DE MOVIMENTOS</span>
        <h1>Desenhar</h1>
      </div>
      <button class="draw-back" type="button" onClick={() => onDialog("exit")}>
        ← Voltar
      </button>
      <div class="draw-tools" role="toolbar" aria-label="Materiais de desenho">
        {session.brushes.slice(0, session.players).map((brush, player) => (
          <Palette
            key={player === 0 ? "left" : "right"}
            brush={brush}
            player={player}
            players={session.players}
            onTool={onTool}
          />
        ))}
        <button
          type="button"
          class="draw-clear"
          aria-label="Nova folha"
          onClick={() => onDialog("clear")}
        >
          <span aria-hidden="true">▧</span>
          <span>Nova folha</span>
        </button>
      </div>
      <p class="draw-hint" role="status">
        {hint}
      </p>
      {dialog === "clear" ? (
        <Confirm
          key="clear"
          title="Uma folha novinha?"
          body="Seu desenho será apagado."
          stay="Continuar desenhando"
          leave="Apagar desenho"
          onStay={() => onDialog(null)}
          onLeave={onClear}
        />
      ) : dialog === "exit" ? (
        <Confirm
          key="exit"
          title="Guardar na imaginação?"
          body="Ao sair, este desenho será apagado."
          stay="Continuar desenhando"
          leave="Sair e apagar"
          onStay={() => onDialog(null)}
          onLeave={onExit}
        />
      ) : null}
    </>
  );
}

export function mountDesenhar(container: HTMLElement, host: GameHost, players: 1 | 2): Experience {
  const session = new DrawSession(players);
  const root = document.createElement("section");
  root.className = "draw-game";
  root.setAttribute("aria-label", "Desenhar");
  const paper = document.createElement("div");
  paper.className = "draw-paper";
  const ui = document.createElement("div");
  ui.className = "draw-ui";
  root.append(paper, ui);
  container.append(root);
  let frame: BodyFrame | null = null;
  let dialog: DialogMode | null = null;
  let hint = "";
  // Nothing is drawn unless a brush, the art, the layout or a dialog changed.
  let stale = true;
  let request = 0;
  let paint: ReturnType<typeof createPaint>;
  try {
    paint = createPaint(paper, (sideMargin) => {
      root.style.setProperty("--draw-margin", `${sideMargin}px`);
      stale = true;
    });
  } catch (error) {
    root.remove();
    throw error;
  }
  const controls = mountMovementControls(root, { pointer: "target" });

  function breakStrokes() {
    session.brushes.forEach((_, player) => {
      session.breakStroke(player);
    });
    stale = true;
  }
  function drawUI() {
    render(
      <DrawUI
        session={session}
        dialog={dialog}
        hint={hint}
        onTool={(player, action) => {
          session.select(player, action);
          stale = true;
          drawUI();
        }}
        onDialog={(next) => {
          dialog = next;
          breakStrokes();
          controls.reset();
          drawUI();
        }}
        onClear={() => {
          session.clear();
          dialog = null;
          stale = true;
          controls.reset();
          drawUI();
        }}
        onExit={host.exit}
      />,
      ui,
    );
  }
  /** A brush over a control or behind a dialog selects; it must not paint. */
  function blocked(point: Point): boolean {
    if (dialog !== null) return true;
    const { x, y } = paint.toScreen(point);
    if (document.elementFromPoint(x, y)?.closest("button")) return true;
    const tools = ui.querySelector(".draw-tools")?.getBoundingClientRect();
    return !!tools && x >= tools.left && x <= tools.right && y >= tools.top && y <= tools.bottom;
  }
  function tick() {
    const now = performance.now();
    const live = frame !== null && isFresh(frame, now);
    if (!live && session.brushes.some((brush) => brush.point !== null)) breakStrokes();
    const points: ControlPoint[] = [];
    session.brushes.forEach((brush, player) => {
      if (brush.point) points.push({ key: String(player), player, ...paint.toScreen(brush.point) });
    });
    controls.update(points, now);
    const nextHint = session.full
      ? "Folha cheia de arte! Desfaça um traço ou comece uma nova folha."
      : !live
        ? "Dê um tchauzinho para o celular."
        : players === 2 && !session.brushes.every((brush) => brush.point)
          ? "Uma pessoa de cada lado. Deixem um espacinho no meio!"
          : session.brushes.some((brush) => brush.painting)
            ? "Isso! Sua mão está pintando ✨"
            : "Levante a outra mão para pintar. Abaixe para passear com o pincel.";
    if (nextHint !== hint) {
      hint = nextHint;
      drawUI();
    }
    if (stale) {
      paint.draw(session, dialog === null);
      stale = false;
    }
    request = requestAnimationFrame(tick);
  }
  drawUI();
  request = requestAnimationFrame(tick);
  return {
    update(next) {
      if (!next || !frame || next.epoch !== frame.epoch || next.sequence <= frame.sequence)
        controls.reset();
      frame = next;
      if (next) paint.setAspect(next.width / next.height);
      session.update(next, performance.now(), blocked);
      stale = true;
    },
    dispose() {
      cancelAnimationFrame(request);
      controls.dispose();
      render(null, ui);
      paint.dispose();
      root.remove();
    },
  };
}
