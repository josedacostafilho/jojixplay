import * as THREE from "three";
import { buildings, ISLAND_HALF_SIZE, type SwingPhysics, type Vec3 } from "./physics";

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
    cap.position.set(building.x, building.height + 0.15, building.z);
    cap.scale.set(building.width + 0.4, 0.3, building.depth + 0.4);
    scene.add(cap);
  }
  const armMaterial = material("#e19f3d"),
    gloveMaterial = material("#254e63");
  const armGeometry = new THREE.CylinderGeometry(0.065, 0.11, 1, 8),
    handGeometry = new THREE.SphereGeometry(0.09, 10, 8);
  geometries.push(armGeometry, handGeometry);
  const up = new THREE.Vector3(0, 1, 0);
  const arms = (["left", "right"] as const).map((side) => {
    const sleeve = new THREE.Mesh(armGeometry, armMaterial);
    const hand = new THREE.Mesh(handGeometry, gloveMaterial);
    camera.add(sleeve, hand);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    geometries.push(geometry);
    const webMaterial = new THREE.LineBasicMaterial({ color: "#fff8e8" });
    materials.push(webMaterial);
    const line = new THREE.Line(geometry, webMaterial);
    scene.add(line);
    return { side, sleeve, hand, line, geometry };
  });
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
  function render(physics: SwingPhysics, now: number) {
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
      const anchor = physics.webs[arm.side]?.point;
      arm.sleeve.visible = arm.hand.visible = arm.line.visible = !!anchor;
      if (!anchor) continue;
      const sign = arm.side === "right" ? 1 : -1;
      const shoulder = new THREE.Vector3(sign * 0.32, -0.4, -0.18);
      const direction = camera.worldToLocal(asVector(anchor)).sub(shoulder).normalize();
      const wrist = shoulder.clone().addScaledVector(direction, 0.9);
      arm.sleeve.position.copy(shoulder).add(wrist).multiplyScalar(0.5);
      arm.sleeve.quaternion.setFromUnitVectors(up, direction);
      arm.sleeve.scale.y = 0.9;
      arm.hand.position.copy(wrist);
      const start = camera.localToWorld(wrist.clone());
      const coordinates = arm.geometry.getAttribute("position") as THREE.BufferAttribute;
      coordinates.setXYZ(0, start.x, start.y, start.z);
      coordinates.setXYZ(1, anchor.x, anchor.y, anchor.z);
      coordinates.needsUpdate = true;
      arm.geometry.computeBoundingSphere();
    }
    renderer.render(scene, camera);
  }
  return {
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      for (const geometry of geometries) geometry.dispose();
      for (const entry of materials) entry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
