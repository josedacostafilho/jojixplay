import { isFresh, type BodyFrame, type Experience } from "@jojixplay/game-sdk";
import * as THREE from "three";
import { colors, colorNames, DrawSession, MAX_MARKS } from "./session";
import "./style.css";

export function mountDesenhar(container: HTMLElement, players: 1 | 2): Experience {
  const session = new DrawSession(players);
  const root = document.createElement("section");
  root.className = "draw-game";
  root.setAttribute("aria-label", "Desenhar");
  root.innerHTML = `<div class="draw-paper"></div><div class="draw-heading"><span>✦ ATELIÊ DE MOVIMENTOS</span><h1>Desenhar</h1></div><div class="draw-tools" aria-label="Materiais de desenho"></div><p class="draw-hint" role="status">Mova uma mão. Levante a outra para pintar!</p><dialog class="draw-dialog"><h2>Uma folha novinha?</h2><p>Seu desenho será apagado.</p><button type="button" data-confirm="no">Continuar desenhando</button><button type="button" data-confirm="yes">Apagar desenho</button></dialog>`;
  container.append(root);
  const paper = root.querySelector<HTMLDivElement>(".draw-paper");
  const tools = root.querySelector<HTMLDivElement>(".draw-tools");
  const hint = root.querySelector<HTMLParagraphElement>(".draw-hint");
  const dialog = root.querySelector<HTMLDialogElement>("dialog");
  if (!paper || !tools || !hint || !dialog)
    throw new Error("Não foi possível abrir os materiais de desenho.");
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    root.remove();
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  paper.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Seu desenho em 3D");
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.z = 5;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbab3a7, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(-2, 4, 5);
  scene.add(light);
  const ball = new THREE.SphereGeometry(1, 12, 8),
    tube = new THREE.CylinderGeometry(1, 1, 1, 8);
  const paint = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 });
  const dots = new THREE.InstancedMesh(ball, paint, MAX_MARKS);
  const lines = new THREE.InstancedMesh(tube, paint, MAX_MARKS);
  dots.count = 0;
  lines.count = 0;
  dots.frustumCulled = false;
  lines.frustumCulled = false;
  scene.add(dots, lines);
  const pointerMaterials = colors.map((color) => new THREE.MeshBasicMaterial({ color }));
  const ringGeometry = new THREE.TorusGeometry(1, 0.12, 8, 32);
  const pointers = [0, 3].map((index) => {
    const group = new THREE.Group();
    const material = pointerMaterials[index];
    const ring = new THREE.Mesh(ringGeometry, material);
    const center = new THREE.Mesh(ball, material);
    center.scale.setScalar(0.35);
    group.add(ring, center);
    scene.add(group);
    group.visible = false;
    return { group, ring, center };
  });
  const count = players;
  let frame: BodyFrame | null = null,
    revision = -1,
    replacement = -1,
    rendered = 0,
    aspect = 16 / 9,
    disposed = false;
  const hover = [
    { button: null as HTMLButtonElement | null, since: 0, latched: false },
    { button: null as HTMLButtonElement | null, since: 0, latched: false },
  ];
  const neutral = [false, false];
  const transform = new THREE.Object3D(),
    up = new THREE.Vector3(0, 1, 0),
    delta = new THREE.Vector3();
  const project = (point: { x: number; y: number }) =>
    new THREE.Vector3((point.x - 0.5) * aspect * 2, (0.5 - point.y) * 2, 0);
  function buildTools() {
    if (!tools) return;
    const focused =
      document.activeElement instanceof HTMLButtonElement && tools.contains(document.activeElement)
        ? document.activeElement
        : null;
    const focusedAction = focused?.dataset.action;
    const focusedPlayer = focused?.closest<HTMLElement>("[data-player]")?.dataset.player;
    tools.innerHTML = "";
    for (let player = 0; player < count; player++) {
      const brush = session.brushes[player];
      if (!brush) continue;
      const row = document.createElement("div");
      row.className = "draw-palette";
      row.dataset.player = String(player);
      row.innerHTML = `<span class="draw-player">${count === 1 ? "Suas cores" : player === 0 ? "Lado esquerdo" : "Lado direito"}</span>`;
      colors.forEach((color, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = `color-${index}`;
        button.setAttribute(
          "aria-label",
          `${colorNames[index]}${count === 2 ? ` · ${player === 0 ? "esquerda" : "direita"}` : ""}`,
        );
        button.setAttribute("aria-pressed", String(brush.color === index));
        button.style.setProperty("--paint", color);
        button.className = "draw-color";
        button.innerHTML = '<span aria-hidden="true">✓</span>';
        row.append(button);
      });
      for (const [action, icon, label] of [
        ["size", brush.thick ? "●" : "•", brush.thick ? "Pincel grosso" : "Pincel fino"],
        ["hand", "✋", brush.leftHand ? "Pintar com a mão esquerda" : "Pintar com a mão direita"],
        ["undo", "↶", "Desfazer"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.setAttribute(
          "aria-label",
          `${label}${count === 2 ? ` · ${player === 0 ? "esquerda" : "direita"}` : ""}`,
        );
        button.title = label ?? "";
        button.textContent = icon ?? "";
        row.append(button);
      }
      tools.append(row);
    }
    const clear = document.createElement("button");
    clear.type = "button";
    clear.dataset.action = "clear";
    clear.className = "draw-clear";
    clear.setAttribute("aria-label", "Nova folha");
    clear.innerHTML = '<span aria-hidden="true">▧</span><span>Nova folha</span>';
    tools.append(clear);
    if (focusedAction)
      [...tools.querySelectorAll<HTMLButtonElement>("button")]
        .find(
          (button) =>
            button.dataset.action === focusedAction &&
            button.closest<HTMLElement>("[data-player]")?.dataset.player === focusedPlayer,
        )
        ?.focus({ preventScroll: true });
    hover.forEach((h) => {
      h.button = null;
      h.latched = false;
      h.since = 0;
    });
  }
  function activate(button: HTMLButtonElement, player: number) {
    const action = button.dataset.action;
    if (!action) return;
    neutral[player] = false;
    session.breakStroke(player);
    if (action === "clear") {
      session.brushes.forEach((_, i) => {
        session.breakStroke(i);
      });
      dialog?.showModal();
      return;
    }
    session.select(player, action);
    buildTools();
  }
  tools.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const row = button.closest<HTMLElement>("[data-player]");
    activate(button, Number(row?.dataset.player ?? 0));
  });
  dialog.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    if (event.target.dataset.confirm === "yes") session.clear();
    dialog.close();
    neutral.fill(false);
  });
  dialog.addEventListener("cancel", () => {
    neutral.fill(false);
  });
  function resize() {
    if (!paper) return;
    const rect = paper.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    const viewportAspect = rect.width / Math.max(1, rect.height);
    const halfHeight = Math.max(1, aspect / viewportAspect);
    camera.left = -halfHeight * viewportAspect;
    camera.right = -camera.left;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    const margin = Math.max(12, (rect.width - Math.min(rect.width, rect.height * aspect)) / 2 + 8);
    if (tools) {
      tools.style.left = `${margin}px`;
      tools.style.right = `${margin}px`;
    }
    revision = -1;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(paper);
  buildTools();
  resize();
  function refreshPaint() {
    if (revision === session.revision) return;
    if (revision < 0 || replacement !== session.replacement) rendered = 0;
    replacement = session.replacement;
    // Undo can remove a middle stroke belonging to one of the two artists.
    if (session.marks.length <= rendered) rendered = 0;
    for (let i = rendered; i < session.marks.length; i++) {
      const mark = session.marks[i];
      if (!mark) continue;
      const a = project(mark.from),
        b = project(mark.to),
        radius = mark.radius * 2;
      const z = i * 0.000015;
      transform.position.copy(b);
      transform.position.z = z;
      transform.quaternion.identity();
      transform.scale.set(radius, radius, radius * 0.6);
      transform.updateMatrix();
      dots.setMatrixAt(i, transform.matrix);
      dots.setColorAt(i, new THREE.Color(mark.color));
      delta.subVectors(b, a);
      transform.position.copy(a).add(b).multiplyScalar(0.5);
      transform.position.z = z;
      transform.quaternion.setFromUnitVectors(
        up,
        delta.length() > 0 ? delta.clone().normalize() : up,
      );
      transform.scale.set(radius, Math.max(0.0001, delta.length()), radius * 0.6);
      transform.updateMatrix();
      lines.setMatrixAt(i, transform.matrix);
      lines.setColorAt(i, new THREE.Color(mark.color));
    }
    rendered = session.marks.length;
    dots.count = rendered;
    lines.count = rendered;
    dots.instanceMatrix.needsUpdate = true;
    lines.instanceMatrix.needsUpdate = true;
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    if (lines.instanceColor) lines.instanceColor.needsUpdate = true;
    revision = session.revision;
  }
  renderer.setAnimationLoop(() => {
    if (disposed) return;
    const now = performance.now(),
      live = frame && isFresh(frame, now) ? frame : null;
    if (!live)
      session.brushes.forEach((_, i) => {
        session.breakStroke(i);
      });
    refreshPaint();
    const rect = renderer.domElement.getBoundingClientRect();
    session.brushes.forEach((brush, i) => {
      const pointer = pointers[i],
        h = hover[i];
      if (!pointer || !h) return;
      pointer.group.visible = !!brush.point && !dialog.open;
      if (!brush.point || dialog.open) {
        h.button?.style.removeProperty("--dwell");
        h.button = null;
        h.latched = false;
        neutral[i] = false;
        return;
      }
      const p = project(brush.point);
      p.z = 0.4;
      pointer.group.position.copy(p);
      pointer.group.scale.setScalar(brush.thick ? 0.047 : 0.035);
      const material = pointerMaterials[brush.color];
      if (material) {
        pointer.ring.material = material;
        pointer.center.material = material;
      }
      pointer.center.visible = brush.painting;
      const ndc = p.clone().project(camera);
      const x = rect.left + ((ndc.x + 1) * rect.width) / 2,
        y = rect.top + ((1 - ndc.y) * rect.height) / 2;
      const button =
        [...tools.querySelectorAll<HTMLButtonElement>("button")].find((button) => {
          const owner = button.closest<HTMLElement>("[data-player]")?.dataset.player;
          if (owner !== undefined && Number(owner) !== i) return false;
          const r = button.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) ?? null;
      if (button !== h.button) {
        if (h.button) h.button.style.removeProperty("--dwell");
        h.button = button;
        h.since = now;
        h.latched = false;
      }
      if (!button) {
        neutral[i] = true;
        return;
      }
      if (!neutral[i] || h.latched) return;
      const progress = Math.min(1, (now - h.since) / 800);
      button.style.setProperty("--dwell", `${progress * 100}%`);
      if (progress === 1) {
        h.latched = true;
        activate(button, i);
      }
    });
    const painting = session.brushes.some((b) => b.painting);
    hint.textContent = session.full
      ? "Folha cheia de arte! Desfaça um traço ou comece uma nova folha."
      : !live
        ? "Dê um tchauzinho para o celular."
        : count === 2 && !session.brushes.every((b) => b.point)
          ? "Uma pessoa de cada lado. Deixem um espacinho no meio!"
          : painting
            ? "Isso! Sua mão está pintando ✨"
            : "Levante a outra mão para pintar. Abaixe para passear com o pincel.";
    renderer.render(scene, camera);
  });
  return {
    update(next) {
      frame = next;
      if (next && aspect !== next.width / next.height) {
        aspect = next.width / next.height;
        resize();
      }
      session.update(next, performance.now(), (point, i) => {
        const position = project(point).project(camera),
          rect = renderer.domElement.getBoundingClientRect();
        const x = rect.left + ((position.x + 1) * rect.width) / 2,
          y = rect.top + ((1 - position.y) * rect.height) / 2;
        const r = tools.getBoundingClientRect();
        return (
          dialog.open || !neutral[i] || (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
        );
      });
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      ball.dispose();
      tube.dispose();
      ringGeometry.dispose();
      paint.dispose();
      pointerMaterials.forEach((m) => {
        m.dispose();
      });
      dots.dispose();
      lines.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      root.remove();
    },
  };
}
