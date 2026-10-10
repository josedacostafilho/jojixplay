import * as THREE from "three";
import bankUrl from "../assets/kenney-voxel/dirt_grass.png?no-inline";
import grassUrl from "../assets/kenney-voxel/grass_top.png?no-inline";
import leafUrl from "../assets/kenney-voxel/leaves.png?no-inline";
import sandUrl from "../assets/kenney-voxel/sand.png?no-inline";
import barkUrl from "../assets/kenney-voxel/trunk_side.png?no-inline";
import woodUrl from "../assets/kenney-voxel/wood.png?no-inline";
import { type ArmsPose, createArms } from "./arms";
import type { Obstacle } from "./course";
import type { Item, Run } from "./run";
import {
  BEAM_SPACING,
  BEAM_UNDERSIDE,
  FIGURE,
  figure,
  LANE,
  LOG_HEIGHT,
  MONSTER,
  RAIL_HEIGHT,
  RAIL_SPREAD,
  stretch,
  torsoTip,
} from "./world";

const ROAD_LENGTH = 150;
const TILE = 3;
const TREES = 44;
const BANKS = 40;
const BUSHES = 30;
const CLOUDS = 9;
const LOAD_TIMEOUT_MS = 20_000;
/** The tangent of half the camera's horizontal angle of view. */
const VIEW_HALF_WIDTH = 1.4;
const STANDING: ArmsPose = {
  arms: { left: null, right: null },
  lean: 0,
  pitch: 0,
  crouch: 0,
  punching: { left: false, right: false },
};
/** Where the eyes of a character standing upright are. */
const EYE_HEIGHT = FIGURE.hip + FIGURE.torso + FIGURE.neck;
/** The view follows a little more slowly than the arms do: tremor here moves the whole picture. */
const EYES_FOLLOW_MS = 110;
/** How near the view an arrived monster stands for the moment before it strikes. */
const MONSTER_LOOMS = 1.3;
/** How long a punched monster takes to fly off. */
const KNOCKED_MS = 700;
/** Hanging from rails, the view draws back and looks up at the hands that hold them. */
const HANGING_VIEW = { back: 0.55, up: 0.4, ms: 260 } as const;
/** How long a glove stays red after its arm throws a punch. */
const PUNCH_FLASH_MS = 250;
/** Stars burst from where a punch lands on a monster: how many, for how long, and how far. */
const BURST = { stars: 14, ms: 550, reach: 3.2 } as const;
/** How far past the character something is still drawn: it is behind the view by then. */
const PASSED_FROM = 1;
/**
 * What the view does of its own accord, each set off by something that happens in the run.
 * Angles are radians, distances world units.
 */
const FX = {
  hit: { ms: 650, back: 0.7, up: 0.12, shake: 0.12 },
  punch: { ms: 240, lunge: 0.55, narrow: 5, jolt: 0.025 },
  jump: { down: 0.3, landMs: 280, dip: 0.24 },
  pool: { ms: 600, down: 0.5, stride: 1.4, bob: 0.06, sway: 0.03 },
  swing: { ms: 380, tilt: 0.06, reach: 0.12 },
  stride: { rate: 0.7, bob: 0.045, sway: 0.008 },
  step: { ms: 380, lean: 0.06 },
  monster: { from: stretch(2.6), turn: 0.13, ms: 260 },
  finish: { from: stretch(0.9), rise: 0.5, up: 0.12 },
} as const;

/**
 * The road seen through the character's eyes. The world slides towards the view, which stays at
 * the same depth and moves only as the player does. Of the character, only the arms are drawn.
 */
export function createScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute("aria-label", "Pista de Corrida dos Blocos");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fd9e5");
  scene.fog = new THREE.Fog("#9fd9e5", 30, 95);
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 130);
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
  // On the road just ahead, where the view can see it.
  glow.position.set(0, 0.02, -5);
  glow.visible = false;
  scene.add(glow);

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
      piece(hide, 0, height * 0.55, edge * 2 + 1, 0.7, 0.9);
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
    // A pool the whole width of the road, and over each lane a pair of rails to cross it by.
    const { length } = obstacle;
    object.add(block(water, 0, 0, edge * 2, 0.04, length));
    for (const lane of [-1, 0, 1])
      for (const side of [-1, 1])
        object.add(block(metal, lane * LANE + side * RAIL_SPREAD, RAIL_HEIGHT, 0.07, 0.07, length));
    for (const along of [0, length]) {
      object.add(block(metal, 0, RAIL_HEIGHT, edge * 2 + 0.5, 0.12, 0.12, along));
      for (const side of [-1, 1])
        object.add(block(metal, side * (edge + 0.2), 0, 0.14, RAIL_HEIGHT + 0.12, 0.14, along));
    }
    return object;
  }
  const built = new Map<Item, THREE.Group>();

  const arms = createArms();
  scene.add(arms.object);
  // One burst at a time: monsters come seconds apart.
  const star = new THREE.MeshBasicMaterial({ color: "#fff3a6" });
  const starGeometry = new THREE.OctahedronGeometry(0.16);
  materials.push(star);
  geometries.push(starGeometry);
  const burst = new THREE.Group();
  for (let index = 0; index < BURST.stars; index += 1)
    burst.add(new THREE.Mesh(starGeometry, star));
  burst.visible = false;
  scene.add(burst);
  let burstFor: Item | null = null;
  let previousAt: number | null = null;
  const eyes = new THREE.Vector3(0, EYE_HEIGHT, 0);
  let hang = 0;
  let stride = 0;
  let turn = 0;
  let lifted = 0;
  let baseFov = 66;

  // The finish: a chequered banner over the road, where the run's length ends.
  const finish = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: "#ffffff" });
  const black = new THREE.MeshBasicMaterial({ color: "#14123a" });
  materials.push(white, black);
  const SQUARES = 16;
  for (let column = 0; column < SQUARES; column += 1)
    for (let row = 0; row < 2; row += 1) {
      const square = new THREE.Mesh(unitBox, (column + row) % 2 ? white : black);
      const size = (edge * 2 + 1) / SQUARES;
      square.scale.set(size, size, 0.2);
      square.position.set((column + 0.5) * size - edge - 0.5, 3.4 + (row + 0.5) * size, 0);
      finish.add(square);
    }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(unitBox, white);
    post.scale.set(0.3, 3.4, 0.3);
    post.position.set(side * (edge + 0.35), 1.7, 0);
    finish.add(post);
  }
  scene.add(finish);

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The same width of world on any screen shape, as far as the angle of view can be opened.
    baseFov = Math.max(
      50,
      Math.min(82, THREE.MathUtils.radToDeg(2 * Math.atan(VIEW_HALF_WIDTH / camera.aspect))),
    );
    camera.fov = baseFov;
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

      arms.pose(
        puppet
          ? {
              arms: running ? run.arms : puppet.arms,
              lean: puppet.lean,
              pitch: puppet.pitch,
              crouch: puppet.crouch,
              punching: {
                left: now - run.punchedAt.left < PUNCH_FLASH_MS,
                right: now - run.punchedAt.right < PUNCH_FLASH_MS,
              },
            }
          : STANDING,
        share,
      );
      const x = run.offset * LANE;
      arms.object.position.x += (x - arms.object.position.x) * share;
      const lift = running ? run.lift : 0;
      arms.object.position.y += (lift - arms.object.position.y) * share;
      glow.visible = running && puppet !== null;
      if (puppet)
        glow.position.x += (puppet.lane * LANE - glow.position.x) * (1 - Math.exp(-elapsed / 45));

      // The view sits where the character's head is and moves as it does: across with each
      // step, down in a crouch, up in a jump. It looks level down the road and never turns:
      // a view that rolled with the player's lean only shook.
      const head = puppet ? figure({ ...puppet, arms: run.arms }).head : { x: 0, y: EYE_HEIGHT };
      const follow = 1 - Math.exp(-elapsed / EYES_FOLLOW_MS);
      // A torso tipped forward carries the head forward with it, ahead of its own shoulders.
      const ahead = puppet
        ? Math.sin(torsoTip(puppet.crouch, puppet.pitch)) * (FIGURE.torso + FIGURE.neck)
        : 0;
      eyes.x += (x + head.x - eyes.x) * follow;
      eyes.y += (lift + head.y - eyes.y) * follow;
      hang += ((run.hanging ? 1 : 0) - hang) * (1 - Math.exp(-elapsed / HANGING_VIEW.ms));
      eyes.z += (0.05 - ahead + hang * HANGING_VIEW.back - eyes.z) * follow;

      // On top of following the player, the view acts out what happens. Every move here is set
      // off by the game and eased, never by the body's own tremor.
      const since = (at: number, ms: number) => Math.min(1, Math.max(0, (now - at) / ms));
      /** Out and back over a span: 0 at both ends, 1 in the middle. */
      const swell = (share: number) => Math.sin(Math.min(1, Math.max(0, share)) * Math.PI);
      const reel = 1 - since(run.hitAt, FX.hit.ms);
      // Running into something takes over from everything else for a moment.
      const calm = 1 - reel;
      let pitch = hang * HANGING_VIEW.up;
      let roll = 0;
      let rise = 0;
      let back = 0;
      let narrow = 0;

      // A hit throws the view back and up and shakes it.
      back += reel * reel * FX.hit.back;
      pitch += reel * reel * FX.hit.up;
      roll += Math.sin(reel * Math.PI * 3) * FX.hit.shake;

      // A punch that lands: a lunge at the monster, a jolt, and the picture pulled in.
      const landed = swell(since(run.connectedAt, FX.punch.ms));
      back -= landed * FX.punch.lunge * calm;
      narrow += landed * FX.punch.narrow * calm;
      roll += Math.sin(since(run.connectedAt, FX.punch.ms) * Math.PI * 4) * landed * FX.punch.jolt;

      // Over a log the view looks down at it passing underneath, and dips on landing.
      if (running && run.arc !== null) pitch -= swell(run.arc) * FX.jump.down * calm;
      rise -= swell(since(run.landedAt, FX.jump.landMs)) * FX.jump.dip * calm;

      // Letting go of the rails pitches the view down at the water; wading through it bobs.
      pitch -= (1 - since(run.fellAt, FX.pool.ms)) ** 2 * FX.pool.down * calm;
      if (running && run.wading) {
        rise += Math.sin(run.distance * FX.pool.stride) * FX.pool.bob;
        roll += Math.sin(run.distance * FX.pool.stride * 0.5) * FX.pool.sway;
      }

      // Hanging, the body swings a little under the hands.
      pitch += hang * Math.sin(now / FX.swing.ms) * FX.swing.tilt;
      back += hang * Math.sin(now / FX.swing.ms) * FX.swing.reach;

      // On the road the view bobs with each stride.
      const grounded = running && !run.hanging && !run.wading && run.lift < 0.05;
      stride += ((grounded ? 1 : 0) - stride) * (1 - Math.exp(-elapsed / 150));
      rise += Math.abs(Math.sin(run.distance * FX.stride.rate)) * FX.stride.bob * stride;
      roll += Math.sin(run.distance * FX.stride.rate) * FX.stride.sway * stride;

      // A step into another lane leans into it, once.
      if (run.stepped)
        roll -= run.stepped.way * swell(since(run.stepped.at, FX.step.ms)) * FX.step.lean * calm;

      // A monster draws the eye: the view turns towards its side of the road as it nears.
      const monster = running
        ? run.items.find((item) => item.state === "coming" && item.obstacle.kind === "monster")
        : undefined;
      const near =
        monster && monster.obstacle.kind === "monster"
          ? -monster.obstacle.lane *
            Math.max(0, 1 - (monster.obstacle.at - run.distance) / FX.monster.from)
          : 0;
      turn += (near * FX.monster.turn - turn) * (1 - Math.exp(-elapsed / FX.monster.ms));

      // Coming up to the finish, time slows and the view lifts to take the banner in.
      const closing = running
        ? Math.max(0, 1 - (run.length - run.distance) / FX.finish.from)
        : run.phase === "finished"
          ? 1
          : 0;
      lifted += (closing - lifted) * (1 - Math.exp(-elapsed / 200));
      rise += lifted * FX.finish.rise;
      pitch += lifted * FX.finish.up;

      camera.position.set(eyes.x, eyes.y + rise, eyes.z + back);
      camera.rotation.set(pitch, turn * calm, roll);
      const fov = baseFov - narrow;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      finish.position.z = run.distance - run.length;
      finish.visible = finish.position.z < PASSED_FROM;

      for (const item of run.items) {
        let made = built.get(item);
        if (!made) {
          made = build(item.obstacle);
          built.set(item, made);
          scene.add(made);
        }
        // A monster comes at the character: further off than its place on the road, closing
        // faster, and waddling as it comes.
        const charging = item.obstacle.kind === "monster";
        const behind = (run.distance - item.obstacle.at) * (charging ? MONSTER.charge : 1);
        // Once it has arrived it looms right in front of the view until it strikes or is punched.
        made.position.z =
          charging && item.state !== "hit" ? Math.min(behind, -MONSTER_LOOMS) : behind;
        if (charging && !item.punched) {
          made.position.y = Math.abs(Math.sin(now / 90)) * 0.25;
          made.rotation.z = Math.sin(now / 90) * 0.06;
        }
        // Each part goes before it reaches the camera.
        for (const part of made.children)
          part.visible = behind - (part.userData.end ?? 0) < PASSED_FROM;
        if (item.punched && burstFor !== item && now - item.punched.at < BURST.ms) {
          // Where the monster stood when it was struck, at about the height of a fist.
          burstFor = item;
          burst.position.set(
            item.obstacle.kind === "monster" ? item.obstacle.lane * LANE : 0,
            MONSTER.height * 0.5,
            behind + 0.8,
          );
          burst.userData.at = item.punched.at;
          burst.userData.from = run.distance;
        }
        if (item.punched) {
          // Knocked up and away down the road, tumbling, to the side it was punched from.
          const flown = Math.min(1, (now - item.punched.at) / KNOCKED_MS);
          made.visible = flown < 1;
          made.position.y = flown * 7;
          made.position.z -= flown * 22;
          made.position.x = (item.punched.side === "left" ? -1 : 1) * flown * 3;
          made.rotation.x = -flown * 4;
        }
      }
      for (const [item, made] of built) {
        if (run.items.includes(item)) continue;
        scene.remove(made);
        built.delete(item);
      }

      // The stars fly out in a ring, slowing, turning and shrinking, as the road carries on.
      const spread = burstFor ? (now - burst.userData.at) / BURST.ms : 1;
      burst.visible = spread < 1;
      if (burstFor && spread < 1) {
        const out = (1 - (1 - spread) ** 2) * BURST.reach;
        burst.children.forEach((child, index) => {
          const angle = (index / BURST.stars) * Math.PI * 2 + (index % 2) * 0.3;
          const far = out * (index % 2 ? 1 : 0.6);
          child.position.set(Math.cos(angle) * far, Math.sin(angle) * far, 0);
          child.rotation.set(spread * 6, spread * 4, 0);
          child.scale.setScalar(1 - spread * 0.8);
        });
      } else burstFor = null;

      sand.offset.y = grass.offset.y = run.distance / TILE;
      for (const object of passing) {
        object.position.z = ((object.userData.at + run.distance) % ROAD_LENGTH) - ROAD_LENGTH + 12;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      window.clearTimeout(timeout);
      observer.disconnect();
      arms.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const map of textures) map.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
