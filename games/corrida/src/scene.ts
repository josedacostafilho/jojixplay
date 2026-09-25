import * as THREE from "three";
import { CameraMotion } from "./camera-motion";
import { BONES, targetPose, type Point, type Skeleton } from "./movement";
import { distanceAt, RUN_SECONDS, type RaceSession } from "./session";

/** A bounded, procedural world: one instanced landscape, one approaching obstacle. */
export function createScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-label", "Pista de Corrida dos Blocos");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fd9e5");
  scene.fog = new THREE.Fog("#9fd9e5", 35, 110);
  const camera = new THREE.PerspectiveCamera(63, 1, 0.1, 145);
  camera.position.set(0, 2.45, 4);
  camera.lookAt(0, 2.2, -30);
  scene.add(new THREE.HemisphereLight(0xfff5d6, 0x456b78, 1.9));
  const sunLight = new THREE.DirectionalLight(0xffe4bd, 1.7);
  sunLight.position.set(-10, 22, 8);
  scene.add(sunLight);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [box];
  const textures: THREE.DataTexture[] = [];
  // Original seamless pixel art, generated once. No image requests or Canvas renderer.
  function texture(kind: "bark" | "leaf" | "earth" | "stone" | "path") {
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    const noise = (x: number, y: number) => {
      const n = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263);
      return ((n ^ (n >>> 13)) >>> 0) % 97;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise(Math.floor(x / 2), Math.floor(y / 2));
        let value = 205 + (n % 42);
        if (kind === "bark") {
          value = 180 + (noise(Math.floor(x / 3), Math.floor(y / 12)) % 65);
          if (x % 8 === 0 || (x % 8 === 1 && y % 16 < 10)) value = 135;
          if ((x - 18) ** 2 + ((y - 15) / 2) ** 2 < 9) value = 145;
        } else if (kind === "leaf") {
          value = 170 + (n % 80);
          if ((x + y) % 8 === 0) value = 255;
        } else if (kind === "stone") {
          const seam = y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0;
          value = seam ? 125 : y % 8 === 1 ? 250 : 190 + (n % 45);
        } else if (kind === "earth") {
          value = n < 22 ? 155 : 205 + (n % 45);
        } else if (n < 12) value = 170;
        const offset = (y * size + x) * 4;
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }
    const result = new THREE.DataTexture(pixels, size, size);
    result.colorSpace = THREE.SRGBColorSpace;
    result.magFilter = THREE.NearestFilter;
    result.minFilter = THREE.NearestMipmapLinearFilter;
    result.generateMipmaps = true;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.needsUpdate = true;
    textures.push(result);
    return result;
  }
  const barkTexture = texture("bark"),
    leafTexture = texture("leaf"),
    earthTexture = texture("earth"),
    stoneTexture = texture("stone"),
    pathTexture = texture("path");
  pathTexture.repeat.set(3.5, 80);
  const groundTexture = texture("earth");
  groundTexture.repeat.set(90, 80);
  const material = (color: string, map: THREE.Texture | null = null) => {
    const m = new THREE.MeshLambertMaterial({ color, map });
    materials.push(m);
    return m;
  };
  const sand = material("#f5ce8b", pathTexture),
    grass = material("#83b85c", groundTexture),
    wood = material("#b27645", barkTexture),
    dark = material("#283f48"),
    gold = material("#ffcd52");
  function cube(
    parent: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    const mesh = new THREE.Mesh(box, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  cube(scene, grass, 0, -0.5, -55, 180, 1, 160);
  cube(scene, sand, 0, -0.08, -55, 7, 0.2, 160);
  // Flat contact strips provide depth without expensive shadow maps or post-processing.
  cube(scene, material("#4e8268"), -4, 0, -55, 1, 0.08, 160);
  cube(scene, material("#4e8268"), 4, 0, -55, 1, 0.08, 160);
  const blocks: {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    color: string;
    surface: "leaf" | "bark" | "earth" | "plain";
  }[] = [];
  const add = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    surface: "leaf" | "bark" | "earth" | "plain" = "leaf",
  ) => blocks.push({ x, y, z, w, h, d, color, surface });
  for (let i = 0; i < 30; i++) {
    const z = -i * 6;
    for (const sign of [-1, 1]) {
      const x = sign * (6 + (i % 3) * 1.4),
        height = 3 + (i % 4) * 0.55;
      add(x, height / 2, z, 0.8, height, 0.8, "#aa7749", "bark");
      add(x, height + 0.6, z, 3.5, 2.1, 3.4, i % 3 ? "#4a9467" : "#86b759");
      add(x + sign * 0.45, height + 1.8, z, 2.4, 1, 2.5, "#91bd6a");
      add(sign * 4.9, 0.2, z + 2, 2.2, 0.4, 2.4, "#9bc773", "earth");
      add(sign * (9 + (i % 5)), 0.8, z + 3, 4, 1.6, 3, "#729b65", "earth");
      add(sign * 4.1, 0.32, z + 1, 0.15, 0.55, 0.15, "#4c8661");
      add(sign * 4.1, 0.62, z + 1, 0.4, 0.3, 0.35, i % 2 ? "#ffe08b" : "#e99885");
      add(sign * 3.4, 0.05, z, 0.14, 0.06, 2.4, "#fff0cc", "plain");
    }
    if (i % 3 === 0) add(((i % 5) - 2) * 8, 12 + (i % 4), z, 8, 1.1, 2.5, "#fff8e5", "plain");
  }
  const transform = new THREE.Object3D();
  const terrain = (["leaf", "bark", "earth", "plain"] as const).map((surface) => {
    const entries = blocks.filter((block) => block.surface === surface);
    const map =
      surface === "leaf"
        ? leafTexture
        : surface === "bark"
          ? barkTexture
          : surface === "earth"
            ? earthTexture
            : null;
    const mesh = new THREE.InstancedMesh(box, material("#ffffff", map), entries.length);
    mesh.frustumCulled = false;
    entries.forEach((block, i) => {
      mesh.setColorAt(i, new THREE.Color(block.color));
    });
    scene.add(mesh);
    return { mesh, entries };
  });
  const sunGeometry = new THREE.IcosahedronGeometry(3, 1);
  geometries.push(sunGeometry);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: "#fff0b9" });
  materials.push(sunMaterial);
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(-25, 20, -90);
  scene.add(sun);
  const gate = new THREE.Group();
  scene.add(gate);
  const gateWhite = material("#fff9e6");
  for (const sign of [-1, 1]) cube(gate, wood, sign * 4.2, 3.1, 0, 0.5, 6.2, 0.6);
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 2; j++)
      cube(
        gate,
        (i + j) % 2 ? dark : gateWhite,
        (i - 5.5) * 0.7,
        5.8 + j * 0.55,
        0,
        0.7,
        0.55,
        0.3,
      );
  const obstacleGroup = new THREE.Group();
  scene.add(obstacleGroup);
  const wallMaterial = material("#ffc94c", stoneTexture);
  const silhouetteMaterial = new THREE.MeshBasicMaterial({
    color: "#153c46",
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  materials.push(silhouetteMaterial);
  const liveMaterial = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.78,
    depthTest: false,
  });
  materials.push(liveMaterial);
  const liveGeometry = new THREE.CylinderGeometry(0.065, 0.065, 1, 6);
  geometries.push(liveGeometry);
  const jointGeometry = new THREE.SphereGeometry(0.1, 8, 6);
  geometries.push(jointGeometry);
  const preview = new THREE.Group();
  const liveBones = BONES.map(() => {
    const mesh = new THREE.Mesh(liveGeometry, liveMaterial);
    preview.add(mesh);
    return mesh;
  });
  const neck = new THREE.Mesh(liveGeometry, liveMaterial);
  preview.add(neck);
  const liveJoints = Object.keys(targetPose("asas")).map((key) => {
    const mesh = new THREE.Mesh(jointGeometry, liveMaterial);
    preview.add(mesh);
    if (key === "nose") mesh.scale.setScalar(2.4);
    return { key: key as keyof Skeleton, mesh };
  });
  let obstacleId = -1;
  let wallGeometry: THREE.ShapeGeometry | null = null;
  let holeGeometry: THREE.ShapeGeometry | null = null;
  let disposed = false;
  const motion = new CameraMotion();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const up = new THREE.Vector3(0, 1, 0),
    delta = new THREE.Vector3();
  function silhouette(target: Skeleton): THREE.Shape {
    const points: Point[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (1.2 - (i * 1.4) / 14);
      points.push({ x: Math.cos(a) * 0.3, y: 0.53 + Math.sin(a) * 0.3 });
    }
    const arm = (side: "left" | "right", reverse: boolean) => {
      const s = target[`${side}Shoulder`],
        e = target[`${side}Elbow`],
        w = target[`${side}Wrist`];
      if (!s || !e || !w) return [];
      const chain = [s, e, w];
      const top: Point[] = [],
        bottom: Point[] = [];
      for (let i = 0; i < chain.length; i++) {
        const p = chain[i];
        const a = chain[Math.max(0, i - 1)],
          b = chain[Math.min(2, i + 1)];
        if (!p || !a || !b) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy);
        const sign = side === "left" ? 1 : -1;
        const nx = (-dy / len) * 0.19 * sign,
          ny = (dx / len) * 0.19 * sign;
        top.push({ x: p.x + nx, y: p.y + ny });
        bottom.push({ x: p.x - nx, y: p.y - ny });
      }
      const path = [...top, ...bottom.reverse()];
      return reverse ? path.reverse() : path;
    };
    points.push(
      ...arm("left", false),
      { x: 0.45, y: -0.88 },
      { x: 0.58, y: -2.3 },
      { x: 0.22, y: -2.3 },
      { x: 0, y: -1.15 },
      { x: -0.22, y: -2.3 },
      { x: -0.58, y: -2.3 },
      { x: -0.45, y: -0.88 },
      ...arm("right", true),
    );
    return new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
  }
  function buildObstacle(session: RaceSession) {
    const obstacle = session.next;
    if (!obstacle || obstacle.id === obstacleId) return;
    obstacleId = obstacle.id;
    obstacleGroup.clear();
    wallGeometry?.dispose();
    holeGeometry?.dispose();
    wallGeometry = holeGeometry = null;
    if (obstacle.kind === "jump") {
      cube(obstacleGroup, wood, 0, 0.45, 0, 6.6, 0.9, 0.6);
      cube(obstacleGroup, gold, 0, 0.95, 0, 6.8, 0.14, 0.75);
      for (const x of [-2.7, -1.35, 0, 1.35, 2.7])
        cube(obstacleGroup, gateWhite, x, 0.47, 0.32, 0.22, 0.6, 0.04).rotation.z = -0.45;
    } else if (obstacle.kind === "duck") {
      for (const x of [-3.3, 3.3]) cube(obstacleGroup, wood, x, 2.6, 0, 0.4, 5.2, 0.5);
      cube(obstacleGroup, wood, 0, 3.65, 0, 7, 3.1, 0.7);
      cube(obstacleGroup, gold, 0, 2.12, 0, 7.2, 0.2, 0.85);
      for (const x of [-2, 0, 2]) cube(obstacleGroup, gold, x, 2.8, 0.39, 0.18, 0.6, 0.06);
    } else {
      const shape = new THREE.Shape([
        new THREE.Vector2(-3.5, 0),
        new THREE.Vector2(3.5, 0),
        new THREE.Vector2(3.5, 5.6),
        new THREE.Vector2(-3.5, 5.6),
      ]);
      const hole = silhouette(targetPose(obstacle.pose));
      const holePoints = hole
        .getPoints()
        .map((p) => new THREE.Vector2(p.x * 1.2, (p.y + 2.35) * 1.2));
      shape.holes.push(new THREE.Path(holePoints));
      wallGeometry = new THREE.ShapeGeometry(shape);
      obstacleGroup.add(new THREE.Mesh(wallGeometry, wallMaterial));
      holeGeometry = new THREE.ShapeGeometry(new THREE.Shape(holePoints));
      const backing = new THREE.Mesh(holeGeometry, silhouetteMaterial);
      backing.position.z = -0.025;
      obstacleGroup.add(backing);
      for (const x of [-3.5, 3.5]) cube(obstacleGroup, dark, x, 2.8, 0, 0.16, 5.8, 0.2);
      cube(obstacleGroup, dark, 0, 5.65, 0, 7.2, 0.16, 0.2);
      preview.position.set(0, 2.35 * 1.2, 0.06);
      preview.scale.setScalar(1.2);
      obstacleGroup.add(preview);
    }
  }
  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height));
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  function render(session: RaceSession, now: number) {
    if (disposed) return;
    const distance = distanceAt(session.elapsed);
    pathTexture.offset.y = (distance / 2) % 1;
    groundTexture.offset.y = (distance / 2) % 1;
    for (const { mesh, entries } of terrain) {
      entries.forEach((b, i) => {
        transform.position.set(b.x, b.y, ((((b.z + distance + 180) % 180) + 180) % 180) - 165);
        transform.scale.set(b.w, b.h, b.d);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    buildObstacle(session);
    const obstacle = session.next;
    const ahead = obstacle ? distanceAt(obstacle.at) - distance : 200;
    obstacleGroup.position.z = 4 - ahead;
    obstacleGroup.visible = !!obstacle && ahead > -2 && ahead < 105 && session.phase !== "won";
    wallMaterial.color.set(session.matching ? "#75e69b" : "#ffcc51");
    liveMaterial.color.set(session.matching ? "#baffed" : "#ffffff");
    const skeleton = session.tracking ? session.movement.skeleton : {};
    BONES.forEach(([from, to], i) => {
      const mesh = liveBones[i],
        a = skeleton[from],
        b = skeleton[to];
      if (!mesh) return;
      mesh.visible = i >= 2 && !!a && !!b;
      if (!a || !b) return;
      delta.set(b.x - a.x, b.y - a.y, 0);
      mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      mesh.quaternion.setFromUnitVectors(up, delta.clone().normalize());
      mesh.scale.y = delta.length();
    });
    const head = skeleton.nose,
      left = skeleton.leftShoulder,
      right = skeleton.rightShoulder;
    neck.visible = !!head && !!left && !!right;
    if (head && left && right) {
      const x = (left.x + right.x) / 2,
        y = (left.y + right.y) / 2;
      delta.set(head.x - x, head.y - 0.24 - y, 0);
      neck.position.set((head.x + x) / 2, (head.y - 0.24 + y) / 2, 0);
      neck.quaternion.setFromUnitVectors(up, delta.clone().normalize());
      neck.scale.y = delta.length();
    }
    liveJoints.forEach(({ key, mesh }) => {
      const p = skeleton[key];
      mesh.visible = !!p;
      if (p) mesh.position.set(p.x, p.y, 0);
    });
    const finishAhead = distanceAt(RUN_SECONDS) - distance;
    gate.visible = finishAhead < 110;
    gate.position.z = 2 - finishAhead;
    camera.position.y = motion.update(
      now,
      session.cameraCrouched,
      session.jumpSerial,
      session.tracking,
      reduced.matches,
    );
    camera.lookAt(0, camera.position.y - 0.25, -30);
    renderer.render(scene, camera);
  }
  return {
    render,
    dispose() {
      disposed = true;
      observer.disconnect();
      wallGeometry?.dispose();
      holeGeometry?.dispose();
      geometries.forEach((g) => {
        g.dispose();
      });
      materials.forEach((m) => {
        m.dispose();
      });
      textures.forEach((t) => {
        t.dispose();
      });
      terrain.forEach(({ mesh }) => {
        mesh.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
