import * as THREE from "three";
import { LANE, stretch } from "../world";

const EDGE = (3 * LANE) / 2;
/** How it is made and how it flies. Distances are world units, times seconds. */
const SNAKE = {
  segments: 96,
  length: 46,
  /** How much faster than the runner it goes: it comes from behind and is gone ahead. */
  overtake: 15,
  from: 34,
  until: -165,
  /**
   * How far out from the path's middle, and how high: beyond the first rank of trees, in the way
   * the forest leaves clear there, half way up the trunks.
   */
  out: EDGE + 8.4,
  height: 10.6,
  girth: 1.0,
  /** How far it throws its coils to either side, and up and down, as it goes. */
  coil: 2.2,
  rise: 0.8,
  flames: 520,
  embers: 240,
} as const;
/** The first passes soon after a run begins; then every so often, on either side. */
const VISITS = { first: stretch(11), least: stretch(34), most: stretch(52) } as const;

// The same curve in the shader and here, so the fire sits exactly on the body it burns from.
// It is a snake's way of going: one wave after another running back down the whole length of
// it, the same width from neck to tail.
const CURVE = `
  vec3 along(float u, float time, float headZ, float side) {
    float s = u * ${SNAKE.length.toFixed(1)};
    return vec3(
      side * (${SNAKE.out.toFixed(2)} + ${SNAKE.coil.toFixed(2)} * sin(s * 0.42 - time * 4.2)),
      ${SNAKE.height.toFixed(2)} + ${SNAKE.rise.toFixed(2)} * sin(s * 0.2 - time * 2.4 + 1.0),
      headZ + s
    );
  }
  float girthAt(float u) {
    float body = 1.0 - 0.18 * u;
    float tail = 0.08 + 0.92 * pow(clamp((1.0 - u) / 0.28, 0.0, 1.0), 0.8);
    return ${SNAKE.girth.toFixed(2)} * min(body, tail);
  }`;
function along(u: number, time: number, headZ: number, side: number, into: THREE.Vector3) {
  const s = u * SNAKE.length;
  return into.set(
    side * (SNAKE.out + SNAKE.coil * Math.sin(s * 0.42 - time * 4.2)),
    SNAKE.height + SNAKE.rise * Math.sin(s * 0.2 - time * 2.4 + 1),
    headZ + s,
  );
}
function girthAt(u: number): number {
  const body = 1 - 0.18 * u;
  const tail = 0.08 + 0.92 * Math.min(1, Math.max(0, (1 - u) / 0.28)) ** 0.8;
  return SNAKE.girth * Math.min(body, tail);
}

/**
 * The Boitatá, the serpent of fire that is this map's boss, seen for now only in passing: every
 * so often it overtakes the runner through the trees at one side, burning, and is gone ahead.
 * It touches nothing and nothing can be done to it; it is a promise of the last level.
 */
export function createBoitata(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // The body: one long glowing length, made of many lumps run together, banded like scales,
  // bright at the neck and deep red at the tail. It burns through the mist, so the mist does not
  // dim it. A faint light clings close about it.
  const lump = new THREE.IcosahedronGeometry(1, 2);
  geometries.push(lump);
  const core = new THREE.MeshBasicMaterial({ fog: false });
  const halo = new THREE.MeshBasicMaterial({
    fog: false,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(core, halo);
  const body = new THREE.InstancedMesh(lump, core, SNAKE.segments);
  const aura = new THREE.InstancedMesh(lump, halo, SNAKE.segments);
  body.frustumCulled = aura.frustumCulled = false;
  const hot = new THREE.Color("#ffe9a6");
  const flame = new THREE.Color("#ff8a14");
  const deep = new THREE.Color("#b81a06");
  const shade = new THREE.Color();
  for (let index = 0; index < SNAKE.segments; index += 1) {
    const u = index / (SNAKE.segments - 1);
    shade.copy(hot).lerp(flame, Math.min(1, u * 4));
    if (u > 0.25) shade.lerp(deep, (u - 0.25) / 0.75);
    // Every third ring is darker: scales, and something for the eye to follow as it slides by.
    if (index % 3 === 0) shade.multiplyScalar(0.62);
    body.setColorAt(index, shade);
    aura.setColorAt(index, flame);
  }
  root.add(body, aura);

  // The head: a broad flat wedge with a jaw that works, eyes like coals gone white, and a
  // forked tongue of flame that flickers out and back.
  const skull = new THREE.MeshBasicMaterial({ color: "#fff1b8", fog: false });
  const maw = new THREE.MeshBasicMaterial({ color: "#ff5a12", fog: false });
  const eye = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
  const pupil = new THREE.MeshBasicMaterial({ color: "#3a0500", fog: false });
  materials.push(skull, maw, eye, pupil);
  const box = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(box);
  const head = new THREE.Group();
  const crown = new THREE.Mesh(lump, skull);
  crown.scale.set(1.55, 0.78, 2.5);
  crown.position.set(0, 0.25, -1.3);
  const jaw = new THREE.Group();
  const chin = new THREE.Mesh(lump, maw);
  chin.scale.set(1.3, 0.4, 2.1);
  chin.position.set(0, 0, -1.9);
  jaw.add(chin);
  jaw.position.set(0, -0.2, 0.6);
  const tongue = new THREE.Group();
  for (const fork of [-1, 1]) {
    const tine = new THREE.Mesh(box, maw);
    tine.scale.set(0.09, 0.06, 1.5);
    tine.position.set(fork * 0.16, 0, -0.75);
    tine.rotation.y = -fork * 0.18;
    tongue.add(tine);
  }
  tongue.position.set(0, -0.05, -3.3);
  for (const side of [-1, 1]) {
    const ball = new THREE.Mesh(lump, eye);
    ball.scale.setScalar(0.34);
    ball.position.set(side * 0.95, 0.72, -1.9);
    const slit = new THREE.Mesh(box, pupil);
    slit.scale.set(0.1, 0.5, 0.2);
    slit.position.set(side * 1.2, 0.74, -2.05);
    head.add(ball, slit);
  }
  head.add(crown, jaw, tongue);
  root.add(head);

  // Flames stand up from its back like a crest, all along it, and embers fall away behind.
  function fire(count: number, embers: boolean) {
    const geometry = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      seeds[index * 3] = Math.random();
      seeds[index * 3 + 1] = Math.random();
      seeds[index * 3 + 2] = Math.random();
    }
    // Places are worked out in the shader from these three numbers alone.
    geometry.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometries.push(geometry);
    const uniforms = {
      time: { value: 0 },
      headZ: { value: 0 },
      side: { value: 1 },
      scale: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float time;
        uniform float headZ;
        uniform float side;
        uniform float scale;
        varying float age;
        varying float heat;
        ${CURVE}
        void main() {
          float u = position.x;
          age = fract(time * ${embers ? "0.5" : "1.9"} * (0.6 + position.y) + position.z * 7.0);
          // Where on the body this flame was born: a little further up it than where it is now.
          vec3 born = along(u, time - age * 0.2, headZ, side);
          float girth = girthAt(u);
          float lean = (position.z - 0.5) * 1.2;
          ${
            embers
              ? `vec3 place = born + vec3(
                  cos(position.y * 40.0) * (0.6 + 2.2 * age),
                  -6.5 * age * age + 1.0 * age,
                  7.0 * age);`
              : `// Up off the back and streaming behind, so the body shows clear beneath.
                vec3 place = born + vec3(
                  lean * girth * (0.5 + age),
                  girth * (0.75 + 2.1 * age),
                  3.2 * age);`
          }
          vec4 seen = modelViewMatrix * vec4(place, 1.0);
          gl_Position = projectionMatrix * seen;
          heat = 1.0 - u * 0.6;
          gl_PointSize = scale * ${embers ? "0.045" : "0.3"} * (0.4 + girth) * (1.0 - age * 0.75)
            / max(1.0, -seen.z);
        }`,
      fragmentShader: `
        varying float age;
        varying float heat;
        void main() {
          float away = length(gl_PointCoord - 0.5) * 2.0;
          float light = pow(max(0.0, 1.0 - away), 1.6) * (1.0 - age);
          vec3 colour = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.8, 0.3), (1.0 - age) * heat);
          gl_FragColor = vec4(colour * light * ${embers ? "2.2" : "0.8"}, light);
        }`,
    });
    materials.push(material);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    root.add(points);
    return uniforms;
  }
  const flames = fire(SNAKE.flames, false);
  const embers = fire(SNAKE.embers, true);

  // Its light on the forest. The lamps are always in the scene, dark when it is away: lighting
  // one only when it comes would make every material be rebuilt at that moment.
  const lamps = [0.03, 0.45].map(() => {
    const lamp = new THREE.PointLight(0xff7a26, 0, 80, 1.4);
    scene.add(lamp);
    return lamp;
  });

  let next = VISITS.first;
  let since: number | null = null;
  let side = 1;
  const place = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const pose = new THREE.Object3D();
  const forward = new THREE.Vector3(0, 0, 1);
  const backward = new THREE.Vector3(0, 0, -1);

  return {
    /**
     * Moves it, if it is passing. Returns how strongly its glow should colour the night, from 0
     * to 1.
     */
    update(now: number, distance: number, running: boolean): number {
      if (since === null) {
        if (!running || distance < next) return 0;
        since = now;
        side = Math.random() < 0.5 ? -1 : 1;
        next = distance + VISITS.least + Math.random() * (VISITS.most - VISITS.least);
        root.visible = true;
      }
      const time = (now - since) / 1000;
      const headZ = SNAKE.from - SNAKE.overtake * time;
      if (headZ + SNAKE.length < SNAKE.until) {
        since = null;
        root.visible = false;
        for (const lamp of lamps) lamp.intensity = 0;
        return 0;
      }
      for (let index = 0; index < SNAKE.segments; index += 1) {
        const u = index / (SNAKE.segments - 1);
        along(u, time, headZ, side, place);
        along(Math.min(1, u + 0.01), time, headZ, side, ahead);
        const girth = girthAt(u);
        pose.position.copy(place);
        pose.quaternion.setFromUnitVectors(forward, ahead.sub(place).normalize());
        // Each lump is drawn out along the body, so they run together into one length.
        pose.scale.set(girth, girth * 0.9, girth * 1.5);
        pose.updateMatrix();
        body.setMatrixAt(index, pose.matrix);
        pose.scale.multiplyScalar(1.45 + 0.12 * Math.sin(time * 14 + index));
        pose.updateMatrix();
        aura.setMatrixAt(index, pose.matrix);
      }
      body.instanceMatrix.needsUpdate = aura.instanceMatrix.needsUpdate = true;

      // The head leads, pointing the way the neck is going.
      along(0, time, headZ, side, place);
      along(0.012, time, headZ, side, ahead);
      head.position.copy(place);
      head.quaternion.setFromUnitVectors(backward, place.clone().sub(ahead).normalize());
      head.scale.setScalar(SNAKE.girth * 1.25);
      jaw.rotation.x = 0.16 + 0.14 * Math.sin(time * 3.1);
      const flick = Math.max(0, Math.sin(time * 9));
      tongue.scale.set(1, 1, 0.2 + flick);
      tongue.visible = flick > 0.05;

      for (const uniforms of [flames, embers]) {
        uniforms.time.value = time;
        uniforms.headZ.value = headZ;
        uniforms.side.value = side;
        uniforms.scale.value = innerHeight;
      }
      // Strongest as it draws level and just after, fading as it goes into the mist.
      const near = Math.max(0, 1 - Math.abs(headZ + 16) / 75);
      lamps.forEach((lamp, index) => {
        along(index === 0 ? 0.03 : 0.45, time, headZ, side, lamp.position);
        lamp.intensity = (index === 0 ? 1100 : 700) * near * (0.85 + 0.15 * Math.sin(time * 23));
      });
      return near;
    },
    /** Sends it away and starts its visits again, as when a run starts over. */
    reset() {
      since = null;
      next = VISITS.first;
      root.visible = false;
      for (const lamp of lamps) lamp.intensity = 0;
    },
    dispose() {
      scene.remove(root);
      for (const lamp of lamps) scene.remove(lamp);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
