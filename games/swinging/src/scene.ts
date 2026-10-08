import type { HandControl } from "./gestures";
import { projectHand } from "./hand-view";
import type { TrackedHands } from "./tracking";
import type { Side } from "./physics";
import * as THREE from "three";
import { buildings, rayTarget, ISLAND_HALF_SIZE, type SwingPhysics, type Vec3 } from "./physics";

const asVector = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);
export const travelYaw = (velocity: Vec3) => -Math.atan2(velocity.x, -velocity.z);

export function createScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-label", "Cidade de blocos do protótipo");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a4d9ef");
  scene.fog = new THREE.Fog("#a4d9ef", 250, 800);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1100);
  camera.rotation.order = "YXZ";
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const material = (color: string) => {
    const result = new THREE.MeshLambertMaterial({ color });
    materials.push(result);
    return result;
  };
  scene.add(new THREE.HemisphereLight(0xffffff, 0x587484, 2));
  const sun = new THREE.DirectionalLight(0xfff0cb, 2);
  sun.position.set(-140, 260, -90);
  scene.add(sun);
  const box = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(box);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), material("#4089a8"));
  geometries.push(water.geometry);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.18;
  scene.add(water);
  const island = new THREE.Mesh(
    new THREE.PlaneGeometry(ISLAND_HALF_SIZE * 2, ISLAND_HALF_SIZE * 2),
    material("#819190"),
  );
  geometries.push(island.geometry);
  island.rotation.x = -Math.PI / 2;
  scene.add(island);
  const road = material("#384a58"),
    colors = [material("#607d95"), material("#8f9eab"), material("#9d8a7f")],
    roof = material("#33495e");
  for (const axis of ["x", "z"] as const) {
    for (const value of [-156, -84, 0, 84, 156]) {
      const strip = new THREE.Mesh(box, road);
      strip.position.set(axis === "x" ? value : 0, 0.05, axis === "z" ? value : 0);
      strip.scale.set(
        axis === "x" ? 32 : ISLAND_HALF_SIZE * 2,
        0.1,
        axis === "z" ? 32 : ISLAND_HALF_SIZE * 2,
      );
      scene.add(strip);
    }
  }
  for (const [i, building] of buildings.entries()) {
    const block = new THREE.Mesh(box, colors[i % colors.length] ?? colors[0]);
    block.position.set(building.x, building.height / 2, building.z);
    block.scale.set(building.width, building.height, building.depth);
    scene.add(block);
    const cap = new THREE.Mesh(box, roof);
    cap.position.set(building.x, building.height - 0.15, building.z);
    cap.scale.set(building.width, 0.3, building.depth);
    scene.add(cap);
  }
  const armMaterial = material("#e19f3d"),
    gloveMaterial = material("#254e63");
  const boneGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const jointGeometry = new THREE.SphereGeometry(1, 8, 6);
  geometries.push(boneGeometry, jointGeometry);
  const up = new THREE.Vector3(0, 1, 0);
  const links = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [13, 17],
    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20],
  ];
  const segment = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
    const direction = b.clone().sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    mesh.scale.set(radius, direction.length(), radius);
  };
  const arms = (["left", "right"] as const).map((side) => {
    const group = new THREE.Group();
    const palmGeometry = new THREE.BufferGeometry();
    palmGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(21 * 3), 3));
    palmGeometry.setIndex([0, 1, 5, 0, 5, 9, 0, 9, 13, 0, 13, 17]);
    geometries.push(palmGeometry);
    const palmMaterial = material("#254e63");
    palmMaterial.side = THREE.DoubleSide;
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    group.add(palm);
    const sleeves = [
      new THREE.Mesh(boneGeometry, armMaterial),
      new THREE.Mesh(boneGeometry, armMaterial),
    ];
    const bones = links.map(() => new THREE.Mesh(boneGeometry, gloveMaterial));
    const joints = Array.from({ length: 21 }, () => new THREE.Mesh(jointGeometry, gloveMaterial));
    group.add(...sleeves, ...bones, ...joints);
    camera.add(group);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    geometries.push(geometry);
    const webMaterial = new THREE.LineBasicMaterial({ color: "#fff8e8" });
    materials.push(webMaterial);
    const line = new THREE.Line(geometry, webMaterial);
    scene.add(line);
    const crosshair = document.createElement("div");
    crosshair.className = "swing-crosshair";
    crosshair.textContent = side === "left" ? "E" : "D";
    crosshair.setAttribute("aria-hidden", "true");
    container.append(crosshair);
    return { side, group, sleeves, bones, joints, line, geometry, crosshair, palmGeometry };
  });
  function ray(aim: { x: number; y: number }) {
    const direction = new THREE.Vector3(aim.x * 2 - 1, 1 - aim.y * 2, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize();
    return {
      origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
    };
  }
  scene.add(camera);
  let yaw = 0,
    lastAt: number | null = null,
    disposed = false;
  function resize() {
    const width = Math.max(1, container.clientWidth),
      height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  function render(
    physics: SwingPhysics,
    now: number,
    controls: Record<Side, HandControl>,
    hands: TrackedHands,
  ) {
    if (disposed) return;
    const dt = lastAt === null ? 0 : Math.min(0.05, Math.max(0, (now - lastAt) / 1000));
    lastAt = now;
    const horizontal = Math.hypot(physics.velocity.x, physics.velocity.z);
    if (horizontal > 0.5) {
      const target = travelYaw(physics.velocity);
      const difference = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
      yaw += Math.max(-1.8 * dt, Math.min(1.8 * dt, difference));
    }
    camera.position.copy(asVector(physics.position));
    camera.rotation.set(Math.max(-0.25, Math.min(0.16, physics.velocity.y / 75)), yaw, 0);
    camera.updateMatrixWorld(true);
    for (const arm of arms) {
      const control = controls[arm.side],
        hand = hands[arm.side];
      const anchor = physics.webs[arm.side]?.point;
      arm.group.visible = !!hand;
      arm.line.visible = !!anchor && !!hand;
      arm.crosshair.hidden = !hand || physics.phase === "lost";
      arm.crosshair.style.left = `${control.aim.x * 100}%`;
      arm.crosshair.style.top = `${control.aim.y * 100}%`;
      const shot = ray(control.aim);
      arm.crosshair.dataset.state = anchor
        ? "held"
        : control.closed
          ? "miss"
          : rayTarget(shot.origin, shot.direction)
            ? "target"
            : "empty";
      if (!hand) continue;
      const sign = arm.side === "right" ? 1 : -1;
      const screenPoints = projectHand(hand);
      const points = screenPoints.map((p) => {
        const halfHeight = -p.z * Math.tan((camera.fov * Math.PI) / 360);
        return new THREE.Vector3(
          (p.x * 2 - 1) * halfHeight * camera.aspect,
          (1 - p.y * 2) * halfHeight,
          p.z,
        );
      });
      const wrist = points[0];
      if (!wrist) continue;
      const shoulder = new THREE.Vector3(sign * 0.48, -0.75, -0.1);
      const elbow = new THREE.Vector3(sign * 0.55, -0.55, -0.55);
      if (arm.sleeves[0]) segment(arm.sleeves[0], shoulder, elbow, 0.075);
      if (arm.sleeves[1]) segment(arm.sleeves[1], elbow, wrist, 0.055);
      const palmPositions = arm.palmGeometry.getAttribute("position");
      points.forEach((point, i) => {
        palmPositions.setXYZ(i, point.x, point.y, point.z);
      });
      palmPositions.needsUpdate = true;
      arm.palmGeometry.computeVertexNormals();
      arm.palmGeometry.computeBoundingSphere();
      points.forEach((point, i) => {
        const joint = arm.joints[i];
        if (joint) {
          joint.position.copy(point);
          joint.scale.setScalar(0.023);
        }
      });
      links.forEach(([a, b], i) => {
        const start = a === undefined ? undefined : points[a],
          end = b === undefined ? undefined : points[b],
          bone = arm.bones[i];
        if (start && end && bone) segment(bone, start, end, 0.018);
      });
      if (anchor) {
        const start = camera.localToWorld(wrist.clone());
        const coordinates = arm.geometry.getAttribute("position") as THREE.BufferAttribute;
        coordinates.setXYZ(0, start.x, start.y, start.z);
        coordinates.setXYZ(1, anchor.x, anchor.y, anchor.z);
        coordinates.needsUpdate = true;
        arm.geometry.computeBoundingSphere();
      }
    }
    renderer.render(scene, camera);
  }
  return {
    render,
    ray,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      for (const arm of arms) arm.crosshair.remove();
      for (const geometry of geometries) geometry.dispose();
      for (const entry of materials) entry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
