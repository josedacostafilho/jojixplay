import * as THREE from "three";
import bankUrl from "../assets/kenney-voxel/dirt_grass.png?no-inline";
import grassUrl from "../assets/kenney-voxel/grass_top.png?no-inline";
import leafUrl from "../assets/kenney-voxel/leaves.png?no-inline";
import sandUrl from "../assets/kenney-voxel/sand.png?no-inline";
import barkUrl from "../assets/kenney-voxel/trunk_side.png?no-inline";
import { type CharacterPose, createCharacter } from "./character";
import type { Run } from "./run";

/**
 * One lane's width in world units. The road is three of them, with no line between. A lane is
 * several times the character's width, so a change of lane is a clear slide across the screen.
 */
export const LANE = 2.5;
const ROAD_LENGTH = 150;
const TILE = 3;
const TREES = 44;
const BANKS = 40;
const BUSHES = 30;
const CLOUDS = 9;
const LOAD_TIMEOUT_MS = 20_000;
/** The tangent of half the camera's horizontal angle of view. */
const VIEW_HALF_WIDTH = 1.4;
const STANDING: CharacterPose = {
  arms: { left: null, right: null },
  lean: 0,
  crouch: 0,
  stride: null,
};

/**
 * The road seen from behind the character. The world slides towards the camera; the character
 * stays at the same depth and moves only as the player does.
 */
export function createScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-label", "Pista de Corrida dos Blocos");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fd9e5");
  scene.fog = new THREE.Fog("#9fd9e5", 30, 95);
  // Fixed behind the middle of the road, just above the character's head and looking nearly
  // level: the road fills the bottom of the screen and runs to the horizon, the whole character
  // stands in the lower half, and what is coming shows over its head and to its sides.
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 130);
  camera.position.set(0, 2.05, 3.6);
  camera.lookAt(0, 1.78, -8);
  scene.add(new THREE.HemisphereLight(0xfff5d6, 0x456b78, 1.9));
  const sun = new THREE.DirectionalLight(0xffe4bd, 1.7);
  sun.position.set(-8, 20, 10);
  scene.add(sun);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  // The world waits for its pictures: a road that pops in half-drawn is worse than a moment's wait.
  let loaded: () => void = () => {};
  let failed: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    loaded = resolve;
    failed = reject;
  });
  const timeout = window.setTimeout(() => failed(new Error("Timed out")), LOAD_TIMEOUT_MS);
  const loader = new THREE.TextureLoader(
    new THREE.LoadingManager(
      () => loaded(),
      undefined,
      () => failed(new Error("A texture failed to load")),
    ),
  );
  function texture(url: string, repeatX: number, repeatY: number) {
    const map = loader.load(url);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = THREE.NearestFilter;
    textures.push(map);
    return map;
  }
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    geometries.push(geometry);
    materials.push(material);
    return new THREE.Mesh(geometry, material);
  }

  const sand = texture(sandUrl, (3 * LANE) / TILE, ROAD_LENGTH / TILE);
  const road = mesh(
    new THREE.PlaneGeometry(3 * LANE, ROAD_LENGTH),
    new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.z = -ROAD_LENGTH / 2 + 12;
  scene.add(road);
  const grass = texture(grassUrl, 120 / TILE, ROAD_LENGTH / TILE);
  const ground = mesh(
    new THREE.PlaneGeometry(120, ROAD_LENGTH),
    new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, road.position.z);
  scene.add(ground);

  // Everything beside the road passes and comes round again; it is what makes the running felt.
  const passing: THREE.Object3D[] = [];
  const edge = (3 * LANE) / 2;
  /** A fixed scatter: the same world every time, with no two things in step. */
  const scatter = (index: number, salt: number) => ((index * salt) % 17) / 17;
  function pass(object: THREE.Object3D, index: number, count: number, salt: number) {
    object.userData.at = (index / count) * ROAD_LENGTH + scatter(index, salt) * 5;
    scene.add(object);
    passing.push(object);
  }

  // Raised banks of earth close the road in on both sides and say where it ends without a line.
  const bankGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bankSide = new THREE.MeshStandardMaterial({ map: texture(bankUrl, 2, 1), roughness: 1 });
  const bankTop = new THREE.MeshStandardMaterial({ map: texture(grassUrl, 2, 2), roughness: 1 });
  geometries.push(bankGeometry);
  materials.push(bankSide, bankTop);
  for (let index = 0; index < BANKS; index += 1) {
    const side = index % 2 ? 1 : -1;
    const width = 2.4 + scatter(index, 7) * 2.2;
    const height = 0.9 + scatter(index, 11) * 1.3;
    const bank = new THREE.Mesh(bankGeometry, [
      bankSide,
      bankSide,
      bankTop,
      bankSide,
      bankSide,
      bankSide,
    ]);
    bank.scale.set(width, height, ROAD_LENGTH / (BANKS / 2) + 0.4);
    bank.position.set(side * (edge + 0.25 + width / 2), height / 2, 0);
    pass(bank, index - (index % 2), BANKS, 1);
  }

  const trunkGeometry = new THREE.BoxGeometry(1, 1, 1);
  const crownGeometry = new THREE.BoxGeometry(1, 1, 1);
  const trunkMaterial = new THREE.MeshStandardMaterial({
    map: texture(barkUrl, 1, 4),
    roughness: 1,
  });
  const crownMaterial = new THREE.MeshStandardMaterial({
    map: texture(leafUrl, 3, 2),
    roughness: 1,
  });
  geometries.push(trunkGeometry, crownGeometry);
  materials.push(trunkMaterial, crownMaterial);
  for (let index = 0; index < TREES; index += 1) {
    const tree = new THREE.Group();
    const height = 5 + scatter(index, 13) * 4;
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.scale.set(1.1, height, 1.1);
    trunk.position.y = height / 2;
    const spread = 4 + scatter(index, 5) * 2.5;
    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.scale.set(spread, 2.6 + scatter(index, 3), spread);
    crown.position.y = height + 0.9;
    tree.add(trunk, crown);
    // Near trees stand on the banks and lean their crowns over the road; others fill in behind.
    const side = index % 2 ? 1 : -1;
    tree.position.set(side * (edge + 2 + scatter(index, 29) * (index % 3 ? 3 : 14)), 0.8, 0);
    pass(tree, index, TREES, 53);
  }
  for (let index = 0; index < BUSHES; index += 1) {
    const size = 0.5 + scatter(index, 19) * 0.5;
    const bush = new THREE.Mesh(crownGeometry, crownMaterial);
    bush.scale.set(size * 1.3, size, size * 1.3);
    bush.position.set((index % 2 ? 1 : -1) * (edge + 0.05 + scatter(index, 23) * 0.2), size / 2, 0);
    pass(bush, index, BUSHES, 31);
  }

  // Clouds hang far off and do not pass: a sky with nothing in it reads as unfinished.
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false });
  materials.push(cloudMaterial);
  for (let index = 0; index < CLOUDS; index += 1) {
    const cloud = new THREE.Mesh(crownGeometry, cloudMaterial);
    cloud.scale.set(9 + scatter(index, 7) * 12, 1.6, 5);
    cloud.position.set((scatter(index, 13) - 0.5) * 150, 20 + scatter(index, 5) * 16, -95);
    scene.add(cloud);
  }

  // The lane the game counts the player in: a soft patch of light on the road, never a line.
  const glow = mesh(
    new THREE.CircleGeometry(0.8, 40),
    new THREE.MeshBasicMaterial({
      color: "#ffd23f",
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.scale.y = 1.7;
  glow.position.set(0, 0.02, -0.3);
  glow.visible = false;
  scene.add(glow);

  const character = createCharacter();
  scene.add(character.object);
  let previousAt: number | null = null;

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The view is as wide as the road at the player's feet on any screen shape: the road reaches
    // towards the bottom corners and the character stays on screen at the road's edge.
    camera.fov = Math.max(
      50,
      Math.min(82, THREE.MathUtils.radToDeg(2 * Math.atan(VIEW_HALF_WIDTH / camera.aspect))),
    );
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return {
    ready,
    render(run: Run, now: number) {
      const elapsed = previousAt === null ? 0 : Math.min(100, now - previousAt);
      previousAt = now;
      // Quick enough to feel direct, slow enough to hide the tremor in tracking.
      const share = 1 - Math.exp(-elapsed / 70);
      const running = run.phase === "running";
      const puppet = run.puppet;

      character.pose(
        puppet
          ? {
              arms: puppet.arms,
              lean: puppet.lean,
              crouch: puppet.crouch,
              stride: running ? run.distance * 1.9 : null,
            }
          : STANDING,
        share,
      );
      const x = (puppet?.offset ?? 0) * LANE;
      character.object.position.x += (x - character.object.position.x) * share;
      glow.visible = running && puppet !== null;
      if (puppet)
        glow.position.x += (puppet.lane * LANE - glow.position.x) * (1 - Math.exp(-elapsed / 45));

      sand.offset.y = grass.offset.y = run.distance / TILE;
      for (const object of passing) {
        object.position.z = ((object.userData.at + run.distance) % ROAD_LENGTH) - ROAD_LENGTH + 12;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      window.clearTimeout(timeout);
      observer.disconnect();
      character.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const map of textures) map.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
