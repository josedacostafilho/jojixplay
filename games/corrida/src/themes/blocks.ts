import * as THREE from "three";
import bankUrl from "../../assets/kenney-voxel/dirt_grass.png?no-inline";
import grassUrl from "../../assets/kenney-voxel/grass_top.png?no-inline";
import leafUrl from "../../assets/kenney-voxel/leaves.png?no-inline";
import sandUrl from "../../assets/kenney-voxel/sand.png?no-inline";
import barkUrl from "../../assets/kenney-voxel/trunk_side.png?no-inline";
import woodUrl from "../../assets/kenney-voxel/wood.png?no-inline";
import { extent, type Obstacle } from "../course";
import {
  BEAM_SPACING,
  BEAM_UNDERSIDE,
  LANE,
  LOG_HEIGHT,
  MONSTER,
  RAIL_HEIGHT,
  RAIL_SPREAD,
} from "../world";
import type { Theme } from "./theme";

const ROAD_LENGTH = 150;
const TILE = 3;
const TREES = 44;
const BANKS = 40;
const BUSHES = 30;
const CLOUDS = 9;
const LOAD_TIMEOUT_MS = 20_000;

/**
 * The first world the game was tried in: a block forest by day, built from boxes and six small
 * textures. It is kept for the studio only, in case something in it is wanted again.
 */
export function createBlocks(scene: THREE.Scene): Theme {
  const added: THREE.Object3D[] = [];
  const place = scene.add.bind(scene);
  // Everything this world puts in the scene is taken out again with it.
  scene.add = (...objects: THREE.Object3D[]) => {
    added.push(...objects);
    return place(...objects);
  };
  scene.background = new THREE.Color("#9fd9e5");
  scene.fog = new THREE.Fog("#9fd9e5", 30, 95);
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

  // Obstacles are built when they come into view and thrown away once they are behind.
  const crate = new THREE.MeshStandardMaterial({ map: texture(woodUrl, 1, 1), roughness: 1 });
  const bark = new THREE.MeshStandardMaterial({ map: texture(barkUrl, 6, 1), roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: "#e23d5b", roughness: 0.5 });
  const water = new THREE.MeshStandardMaterial({ color: "#2f9fe0", roughness: 0.25 });
  const hide = new THREE.MeshStandardMaterial({ color: "#8a4fd6", roughness: 0.8 });
  const pale = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const dark = new THREE.MeshBasicMaterial({ color: "#14123a" });
  materials.push(crate, bark, metal, water, hide, pale, dark);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const logGeometry = new THREE.CylinderGeometry(LOG_HEIGHT / 2, LOG_HEIGHT / 2, 1, 14);
  geometries.push(unitBox, logGeometry);
  /** A box standing on `y`, `along` world units further down the road than its obstacle starts. */
  function block(
    material: THREE.Material,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    along = 0,
  ) {
    const part = new THREE.Mesh(unitBox, material);
    part.scale.set(width, height, depth);
    part.position.set(x, y + height / 2, -along - (depth > 1.5 ? depth / 2 : 0));
    // A part is done with once its far end is behind the character.
    part.userData.end = along + (depth > 1.5 ? depth : 0);
    return part;
  }
  function build(obstacle: Obstacle): THREE.Group {
    const object = new THREE.Group();
    if (obstacle.kind === "block") {
      for (const lane of obstacle.lanes)
        object.add(block(crate, lane * LANE, 0, LANE * 0.8, 1.9, 1.3));
      return object;
    }
    if (obstacle.kind === "beam") {
      // Each underside is where the rule says it is: a character whose head is lower goes under.
      // A tunnel is open between its beams, so the character is seen all the way through.
      for (let beam = 0; beam < obstacle.beams; beam += 1) {
        const along = beam * BEAM_SPACING;
        object.add(block(crate, 0, BEAM_UNDERSIDE, edge * 2 + 0.6, 0.5, 0.5, along));
        for (const side of [-1, 1])
          object.add(block(crate, side * (edge + 0.1), 0, 0.5, BEAM_UNDERSIDE + 0.5, 0.5, along));
      }
      return object;
    }
    /** A square pipe of crates along a lane: walls and a roof where a beam's underside is. */
    const pipe = (lane: number, length: number) => {
      object.add(block(crate, lane * LANE, BEAM_UNDERSIDE, LANE * 0.8, 0.3, length));
      for (const side of [-1, 1])
        object.add(
          block(crate, lane * LANE + side * LANE * 0.4, 0, 0.2, BEAM_UNDERSIDE + 0.3, length),
        );
    };
    if (obstacle.kind === "fall") {
      // In this world it is already down: a crate on the side it fell from, and a beam over
      // the middle lane at the height of any other.
      object.add(block(crate, obstacle.from * LANE, 0, LANE * 0.9, 1.9, 1.3));
      object.add(block(crate, 0, BEAM_UNDERSIDE, LANE, 0.5, 0.5));
      return object;
    }
    if (obstacle.kind === "trunk") {
      pipe(obstacle.lane, obstacle.length);
      return object;
    }
    if (obstacle.kind === "log") {
      const log = new THREE.Mesh(logGeometry, bark);
      log.rotation.z = Math.PI / 2;
      log.scale.y = edge * 2 + 0.4;
      log.position.y = LOG_HEIGHT / 2;
      object.add(log);
      return object;
    }
    if (obstacle.kind === "monster") {
      // Big, standing in its lane, with arms that reach right across the road: there is no way
      // round it. It faces the character.
      const { width, height } = MONSTER;
      const x = obstacle.lane * LANE;
      const piece = (
        material: THREE.Material,
        across: number,
        up: number,
        wide: number,
        tall: number,
        deep: number,
        forward = 0,
      ) => {
        const part = new THREE.Mesh(unitBox, material);
        part.scale.set(wide, tall, deep);
        part.position.set(across, up, forward);
        object.add(part);
      };
      piece(hide, x, height / 2, width, height, 1.4);
      // Only a great one's arms reach right across the road.
      if (obstacle.size === "great") piece(hide, 0, height * 0.55, edge * 2 + 1, 0.7, 0.9);
      for (const side of [-1, 1]) {
        piece(hide, x + side * width * 0.3, height + 0.3, 0.5, 0.7, 0.5);
        piece(pale, x + side * width * 0.22, height * 0.78, 0.7, 0.7, 0.1, 0.71);
        piece(dark, x + side * width * 0.2, height * 0.76, 0.3, 0.3, 0.1, 0.76);
      }
      piece(dark, x, height * 0.42, width * 0.6, 0.45, 0.1, 0.71);
      for (const tooth of [-0.5, 0, 0.5])
        piece(pale, x + tooth * width * 0.4, height * 0.46, 0.3, 0.26, 0.1, 0.76);
      return object;
    }
    // A pool the whole width of the road, dark for a ravine. Over one lane a pair of rails to
    // cross it by, or through another a pipe, or both.
    // As long as the whole way across is: to where a character is set down and on its feet.
    const length = extent(obstacle);
    object.add(block(obstacle.over === "river" ? water : dark, 0, 0, edge * 2, 0.04, length));
    if (obstacle.trunk !== null) pipe(obstacle.trunk, length);
    if (obstacle.vine !== null) {
      for (const side of [-1, 1])
        object.add(
          block(metal, obstacle.vine * LANE + side * RAIL_SPREAD, RAIL_HEIGHT, 0.07, 0.07, length),
        );
      for (const along of [0, length]) {
        object.add(block(metal, 0, RAIL_HEIGHT, edge * 2 + 0.5, 0.12, 0.12, along));
        for (const side of [-1, 1])
          object.add(block(metal, side * (edge + 0.2), 0, 0.14, RAIL_HEIGHT + 0.12, 0.14, along));
      }
    }
    return object;
  }
  scene.add = place;

  return {
    ready,
    grip: "rails",
    build,
    update({ distance }) {
      sand.offset.y = grass.offset.y = distance / TILE;
      for (const object of passing) {
        object.position.z = ((object.userData.at + distance) % ROAD_LENGTH) - ROAD_LENGTH + 12;
      }
    },
    dispose() {
      window.clearTimeout(timeout);
      for (const object of added) scene.remove(object);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const map of textures) map.dispose();
      scene.fog = null;
      scene.background = null;
    },
  };
}
