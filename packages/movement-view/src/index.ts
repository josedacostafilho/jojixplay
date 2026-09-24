import { isFresh, type BodyFrame, type Experience, type JointName } from "@jojixplay/game-sdk";
import * as THREE from "three";
import { softenMovement } from "./presentation";

const connections: ReadonlyArray<readonly [JointName, JointName]> = [
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];
const visibleJoints: readonly JointName[] = [
  "nose",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
];

/** Diagnostic scene, also used by the independent development harness. */
export function mountMovementView(container: HTMLElement): Experience {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0xffffff, 0);
  renderer.domElement.setAttribute("aria-label", "Visualização dos movimentos");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 2.5, -2.5, 0.1, 40);
  camera.position.z = 12;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x95a5b1, 2.5));
  const light = new THREE.DirectionalLight(0xfff2d5, 3);
  light.position.set(-3, 6, 8);
  scene.add(light);
  const ball = new THREE.SphereGeometry(1, 24, 16);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const colors = [0xef846d, 0x5b9cde];
  const materials = colors.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
  );
  const eyes = new THREE.MeshStandardMaterial({ color: 0x293b3d });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff8e5 });
  const toys = new THREE.Group();
  scene.add(toys);
  function sphere(
    parent: THREE.Group,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy = sx,
    sz = sx,
  ) {
    const mesh = new THREE.Mesh(ball, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }
  for (let i = 0; i < 2; i++) {
    const material = materials[i];
    if (!material) continue;
    const character = new THREE.Group();
    character.position.set(i ? 1.25 : -1, i ? -0.55 : -0.2, 0);
    character.rotation.z = i ? -0.12 : 0.1;
    const scale = i ? 0.78 : 1;
    character.scale.setScalar(scale);
    toys.add(character);
    sphere(character, material, 0, 0, 0, 0.92, 1.25, 0.65);
    sphere(character, material, -0.9, 0.1, 0, 0.28, 0.65, 0.3).rotation.z = -0.55;
    sphere(character, material, 0.9, 0.55, 0, 0.28, 0.65, 0.3).rotation.z = -0.6;
    sphere(character, material, -0.4, -1.15, 0.1, 0.33, 0.3, 0.45);
    sphere(character, material, 0.4, -1.15, 0.1, 0.33, 0.3, 0.45);
    for (const x of [-0.28, 0.28]) {
      sphere(character, cream, x, 0.35, 0.58, 0.22, 0.27, 0.1);
      sphere(character, eyes, x + 0.04, 0.34, 0.67, 0.085, 0.12, 0.04);
    }
    sphere(character, cream, 0, -0.05, 0.65, 0.2, 0.08, 0.04);
  }
  const bodies = materials.map((material) => {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const joints = visibleJoints.map(() => sphere(group, material, 0, 0, 0, 0.1));
    const links = connections.map(() => {
      const mesh = new THREE.Mesh(cylinder, material);
      group.add(mesh);
      return mesh;
    });
    return { group, joints, links };
  });
  let frame: BodyFrame | null = null;
  let receivedInput = false;
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const position = (point: { x: number; y: number }, width: number, height: number) =>
    new THREE.Vector3((0.5 - point.x) * width, (0.5 - point.y) * height, 0);
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(Math.max(width, 1), Math.max(height, 1));
    camera.left = (-2.5 * width) / Math.max(height, 1);
    camera.right = -camera.left;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  renderer.setAnimationLoop((time) => {
    const live = frame && isFresh(frame, performance.now()) ? frame : null;
    toys.visible = !receivedInput;
    if (!reducedMotion.matches) toys.rotation.z = Math.sin(time * 0.0006) * 0.025;
    for (const [index, visual] of bodies.entries()) {
      const body = live?.bodies[index];
      visual.group.visible = !!body;
      if (!body || !live) continue;
      // Fit the canonical camera frame without stretching or cropping it.
      const aspect = live.width / live.height;
      const height = Math.min(4.3, (camera.right - camera.left) / aspect);
      const width = height * aspect;
      visibleJoints.forEach((name, j) => {
        const mesh = visual.joints[j];
        if (!mesh) return;
        const point = body[name];
        mesh.visible = !!point;
        if (point) mesh.position.copy(position(point, width, height));
      });
      connections.forEach(([a, b], j) => {
        const mesh = visual.links[j];
        if (!mesh) return;
        const start = body[a],
          end = body[b];
        mesh.visible = !!start && !!end;
        if (!start || !end) return;
        const p = position(start, width, height),
          q = position(end, width, height);
        direction.subVectors(q, p);
        mesh.position.copy(p).add(q).multiplyScalar(0.5);
        mesh.scale.set(0.065, direction.length(), 0.065);
        mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      });
    }
    renderer.render(scene, camera);
  });
  return {
    update(next) {
      receivedInput = true;
      frame = next ? softenMovement(frame, next) : null;
    },
    dispose() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      ball.dispose();
      cylinder.dispose();
      for (const material of [...materials, eyes, cream]) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
