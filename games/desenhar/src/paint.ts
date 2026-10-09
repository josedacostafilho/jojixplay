import * as THREE from "three";
import { colors, type DrawSession, MAX_MARKS, type Point } from "./session";

/**
 * The Three.js paint surface: bounded instanced strokes and one ring pointer per brush. It draws
 * only when asked. `onLayout` reports the empty margin beside the camera-shaped drawing area.
 */
export function createPaint(paper: HTMLElement, onLayout: (sideMargin: number) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-label", "Seu desenho em 3D");
  paper.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.z = 5;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbab3a7, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(-2, 4, 5);
  scene.add(light);

  const ball = new THREE.SphereGeometry(1, 12, 8);
  const tube = new THREE.CylinderGeometry(1, 1, 1, 8);
  const ringGeometry = new THREE.TorusGeometry(1, 0.12, 8, 32);
  const paint = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 });
  const dots = new THREE.InstancedMesh(ball, paint, MAX_MARKS);
  const lines = new THREE.InstancedMesh(tube, paint, MAX_MARKS);
  dots.count = lines.count = 0;
  dots.frustumCulled = lines.frustumCulled = false;
  scene.add(dots, lines);
  const pointerMaterials = colors.map((color) => new THREE.MeshBasicMaterial({ color }));
  const pointers = [0, 1].map(() => {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(ringGeometry, pointerMaterials[0]);
    const center = new THREE.Mesh(ball, pointerMaterials[0]);
    center.scale.setScalar(0.35);
    group.add(ring, center);
    group.visible = false;
    scene.add(group);
    return { group, ring, center };
  });

  let aspect = 16 / 9;
  let revision = -1;
  let replacement = -1;
  let rendered = 0;
  const transform = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const color = new THREE.Color();

  /** Mirrored normalized camera space onto a plane as tall as the view and `aspect` times as wide. */
  const project = (point: Point, target: THREE.Vector3) =>
    target.set((point.x - 0.5) * aspect * 2, (0.5 - point.y) * 2, 0);

  /** The camera-shaped drawing area is fitted inside the paper, never cropped. */
  function fitPaper() {
    const rect = paper.getBoundingClientRect();
    const viewAspect = rect.width / Math.max(1, rect.height);
    const halfHeight = Math.max(1, aspect / viewAspect);
    return { rect, halfWidth: halfHeight * viewAspect, halfHeight };
  }
  function resize() {
    const { rect, halfWidth, halfHeight } = fitPaper();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    revision = -1;
    onLayout((rect.width - Math.min(rect.width, rect.height * aspect)) / 2);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(paper);
  resize();

  function syncMarks(session: DrawSession) {
    if (revision === session.revision) return;
    // Undo can remove a middle stroke belonging to one of the two artists.
    if (revision < 0 || replacement !== session.replacement || session.marks.length <= rendered)
      rendered = 0;
    replacement = session.replacement;
    for (let i = rendered; i < session.marks.length; i++) {
      const mark = session.marks[i];
      if (!mark) continue;
      project(mark.from, from);
      project(mark.to, to);
      const radius = mark.radius * 2;
      const z = i * 0.000015;
      color.set(mark.color);
      transform.position.copy(to).setZ(z);
      transform.quaternion.identity();
      transform.scale.set(radius, radius, radius * 0.6);
      transform.updateMatrix();
      dots.setMatrixAt(i, transform.matrix);
      dots.setColorAt(i, color);
      delta.subVectors(to, from);
      const length = delta.length();
      transform.position.addVectors(from, to).multiplyScalar(0.5).setZ(z);
      if (length > 0) transform.quaternion.setFromUnitVectors(up, delta.divideScalar(length));
      transform.scale.set(radius, Math.max(0.0001, length), radius * 0.6);
      transform.updateMatrix();
      lines.setMatrixAt(i, transform.matrix);
      lines.setColorAt(i, color);
    }
    rendered = session.marks.length;
    dots.count = lines.count = rendered;
    dots.instanceMatrix.needsUpdate = lines.instanceMatrix.needsUpdate = true;
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    if (lines.instanceColor) lines.instanceColor.needsUpdate = true;
    revision = session.revision;
  }

  return {
    setAspect(next: number) {
      if (next === aspect) return;
      aspect = next;
      resize();
    },
    /** Viewport pixels for a mirrored normalized point, matching what `draw` renders. */
    toScreen(point: Point): Point {
      const { rect, halfWidth, halfHeight } = fitPaper();
      return {
        x: rect.left + (0.5 + ((point.x - 0.5) * aspect) / halfWidth) * rect.width,
        y: rect.top + (0.5 + (point.y - 0.5) / halfHeight) * rect.height,
      };
    },
    draw(session: DrawSession, showPointers: boolean) {
      syncMarks(session);
      session.brushes.forEach((brush, i) => {
        const pointer = pointers[i];
        if (!pointer) return;
        pointer.group.visible = showPointers && brush.point !== null;
        if (!brush.point) return;
        project(brush.point, pointer.group.position).setZ(0.4);
        pointer.group.scale.setScalar(brush.thick ? 0.047 : 0.035);
        const material = pointerMaterials[brush.color];
        if (material) pointer.ring.material = pointer.center.material = material;
        pointer.center.visible = brush.painting;
      });
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      ball.dispose();
      tube.dispose();
      ringGeometry.dispose();
      paint.dispose();
      for (const material of pointerMaterials) material.dispose();
      dots.dispose();
      lines.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
