import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { extent, type Obstacle } from "../course";
import {
  BEAM_SPACING,
  BEAM_UNDERSIDE,
  FELLING,
  LANE,
  LOG_HEIGHT,
  MONSTER,
  RAIL_HEIGHT,
  RAVINE,
  RECESS,
  TRUNK,
  WATER_LEVEL,
} from "../world";
import { createBoitata } from "./boitata";
import type { Theme } from "./theme";

// Vite needs each address written out to find the file and give it a fingerprinted name.
const MODELS = {
  treeA: new URL("../../assets/jungle/tree_a.glb", import.meta.url).href,
  treeB: new URL("../../assets/jungle/tree_b.glb", import.meta.url).href,
  treeC: new URL("../../assets/jungle/tree_c.glb", import.meta.url).href,
  palm: new URL("../../assets/jungle/palm.glb", import.meta.url).href,
  banana: new URL("../../assets/jungle/banana.glb", import.meta.url).href,
  fern: new URL("../../assets/jungle/fern.glb", import.meta.url).href,
  plant: new URL("../../assets/jungle/plant.glb", import.meta.url).href,
  plantBig: new URL("../../assets/jungle/plant_big.glb", import.meta.url).href,
  monstera: new URL("../../assets/jungle/monstera.glb", import.meta.url).href,
  bromeliad: new URL("../../assets/jungle/bromeliad.glb", import.meta.url).href,
  bush: new URL("../../assets/jungle/bush.glb", import.meta.url).href,
  vinesA: new URL("../../assets/jungle/vines_a.glb", import.meta.url).href,
  vinesB: new URL("../../assets/jungle/vines_b.glb", import.meta.url).href,
  rockA: new URL("../../assets/jungle/rock_a.glb", import.meta.url).href,
  rockB: new URL("../../assets/jungle/rock_b.glb", import.meta.url).href,
  stump: new URL("../../assets/jungle/stump.glb", import.meta.url).href,
  mushrooms: new URL("../../assets/jungle/mushrooms.glb", import.meta.url).href,
  jaguar: new URL("../../assets/jungle/jaguar.glb", import.meta.url).href,
  anaconda: new URL("../../assets/jungle/anaconda.glb", import.meta.url).href,
  peccary: new URL("../../assets/jungle/peccary.glb", import.meta.url).href,
  caiman: new URL("../../assets/jungle/caiman.glb", import.meta.url).href,
  piranha: new URL("../../assets/jungle/piranha.glb", import.meta.url).href,
} as const;
type ModelName = keyof typeof MODELS;

const LOAD_TIMEOUT_MS = 30_000;
/** The turn that brings the anaconda's head, which its model has to one side, round to the view. */
const SNAKE_FACING = -Math.PI / 2;
/** The forest is laid in stretches this long that come round again one after another. */
const CHUNK = 42;
const CHUNKS = 4;
/** Beyond this the mist hides everything; a stretch comes round again only further off still. */
const SIGHT = 118;
/** Nothing hangs lower over the road than this, so scenery is never taken for something to duck. */
const CLEAR_HEIGHT = 4.2;
const EDGE = (3 * LANE) / 2;
const NIGHT = "#0a2230";
/** How many rivers and ravines can be open in the ground at once. */
const OPENINGS = 4;
/** No opening: nowhere is both nearer than its near edge and further than its far one. */
const NOWHERE = -9999;
/**
 * How far beyond where a gap is said to end its far edge is drawn, at a place across it, as a
 * share of the most that is allowed for. Across the road it is between none and all of it, in
 * long uneven bites; out in the forest, where nobody runs, it goes much further both ways.
 * The ground's own shader works out the same thing, to open the ground to the same line.
 */
function ragged(x: number, phase: number): number {
  let road = 0.5 + 0.3 * Math.sin(x * 0.31 + phase) + 0.2 * Math.sin(x * 0.83 + phase * 2.3);
  road = road * road * (3 - 2 * road);
  const out = Math.min(1, Math.max(0, (Math.abs(x) - (EDGE + 0.8)) / 6.2));
  const far = Math.sin(x * 0.11 + phase * 1.3) + 0.6 * Math.sin(x * 0.27 + phase * 0.6);
  return road + out * out * (3 - 2 * out) * far * 1.3;
}
const RAGGED = `
  float ragged(float x, float phase) {
    float road = 0.5 + 0.3 * sin(x * 0.31 + phase) + 0.2 * sin(x * 0.83 + phase * 2.3);
    road = road * road * (3.0 - 2.0 * road);
    float far = sin(x * 0.11 + phase * 1.3) + 0.6 * sin(x * 0.27 + phase * 0.6);
    return road + smoothstep(${(EDGE + 0.8).toFixed(2)}, ${(EDGE + 7).toFixed(2)}, abs(x)) * far * 1.3;
  }`;

/** One drawable piece of a model: models made of several materials have several. */
interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}
/** A model brought to a standard place and size: standing on the ground, centred, one unit tall. */
interface Model {
  readonly parts: readonly Part[];
  /** Its width and depth, for a height of one. */
  readonly wide: number;
  readonly deep: number;
}

/** A small seeded generator, so the forest is the same every time. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiling picture of mottled colour, made here so the ground needs no file. */
function mottled(
  size: number,
  seed: number,
  shade: (noise: number, speck: number) => readonly [number, number, number],
): THREE.DataTexture {
  const next = random(seed);
  const coarse = Array.from({ length: 64 }, () => next());
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Smooth noise on an 8 by 8 grid that wraps, so the picture tiles without a seam.
      const u = (x / size) * 8;
      const v = (y / size) * 8;
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = u - x0;
      const fy = v - y0;
      const at = (ix: number, iy: number) => coarse[(iy % 8) * 8 + (ix % 8)] ?? 0;
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
      const [r, g, b] = shade(top + (bottom - top) * fy, next());
      const index = (y * size + x) * 4;
      data[index] = r * 255;
      data[index + 1] = g * 255;
      data[index + 2] = b * 255;
      data[index + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/**
 * The Amazon forest at night under a full moon: tall close trees, thick undergrowth, vines over
 * the path, mist in the distance, fireflies. The models are free ones by several authors, named
 * with their licences beside the files; everything else is made here.
 */
export function createJungle(scene: THREE.Scene): Theme {
  const added: THREE.Object3D[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const add = <T extends THREE.Object3D>(object: T): T => {
    scene.add(object);
    added.push(object);
    return object;
  };
  const keep = <T extends THREE.Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const shape = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  scene.background = new THREE.Color(NIGHT);
  // Mist closes the forest in: what is far is only a paler shade of night.
  scene.fog = new THREE.Fog("#12384a", 20, SIGHT);
  // The moon is ahead and to the left, so everything is edged with its light; a dim cool light
  // from behind the view is the eye grown used to the dark, and keeps what comes readable.
  add(new THREE.HemisphereLight(0x7fb0e8, 0x0b1f14, 1.25));
  const moonlight = add(new THREE.DirectionalLight(0xcfe2ff, 2.6));
  moonlight.position.set(-14, 26, -20);
  const eyesight = add(new THREE.DirectionalLight(0x9dbbd8, 1.25));
  eyesight.position.set(4, 8, 14);

  // The moon itself, with a halo, and a few stars: far beyond the mist.
  const disc = shape(new THREE.CircleGeometry(1, 40));
  const moon = add(
    new THREE.Mesh(disc, keep(new THREE.MeshBasicMaterial({ color: "#f4f8ff", fog: false }))),
  );
  moon.position.set(-34, 46, -118);
  moon.scale.setScalar(7);
  for (const [size, opacity] of [
    [13, 0.16],
    [24, 0.07],
  ] as const) {
    const halo = add(
      new THREE.Mesh(
        disc,
        keep(
          new THREE.MeshBasicMaterial({
            color: "#bcd8ff",
            fog: false,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      ),
    );
    halo.position.copy(moon.position).z += 0.5;
    halo.scale.setScalar(size);
  }
  {
    const next = random(7);
    const points = new Float32Array(240 * 3);
    for (let index = 0; index < 240; index += 1) {
      points[index * 3] = (next() - 0.5) * 320;
      points[index * 3 + 1] = 30 + next() * 90;
      points[index * 3 + 2] = -125;
    }
    const sky = shape(new THREE.BufferGeometry());
    sky.setAttribute("position", new THREE.BufferAttribute(points, 3));
    add(
      new THREE.Points(
        sky,
        keep(
          new THREE.PointsMaterial({
            color: "#dfeaff",
            size: 1.6,
            sizeAttenuation: false,
            fog: false,
          }),
        ),
      ),
    );
  }

  // The ground: trodden earth with fallen leaves down the middle, darker forest floor either
  // side, and no line between them. It is one rough sheet that does not move: its humps, ruts
  // and puddles are worked out from how far the run has come, so they go by underfoot.
  const earth = mottled(128, 3, (noise, speck) => {
    const leaf = speck > 0.93;
    const tone = 0.55 + noise * 0.6;
    return leaf ? [0.42 * tone, 0.36 * tone, 0.12 * tone] : [0.3 * tone, 0.2 * tone, 0.12 * tone];
  });
  const floor = mottled(128, 5, (noise, speck) => {
    const tone = 0.45 + noise * 0.7 + (speck > 0.9 ? 0.15 : 0);
    return [0.08 * tone, 0.22 * tone, 0.1 * tone];
  });
  textures.push(earth, floor);
  const SPAN = CHUNK * CHUNKS;
  /** Where a river or a ravine breaks the ground: each one's near and far edge, as the view has them. */
  const openings = {
    // Its near and far edge, then which ragged far edge it has and how far that may go.
    value: Array.from({ length: OPENINGS }, () => new THREE.Vector4(NOWHERE, NOWHERE, 0, 0)),
  };
  const lie = {
    travelled: { value: 0 },
    earthMap: { value: earth },
    floorMap: { value: floor },
    gaps: openings,
  };
  {
    // Fine where the path is and coarse out in the forest and far ahead.
    const across: number[] = [];
    for (let x = -9; x <= 9.001; x += 0.45) across.push(x);
    for (let x = 9, step = 0.9; x < 70; step *= 1.4) {
      x += step;
      across.push(x, -x);
    }
    across.sort((a, b) => a - b);
    const down: number[] = [];
    for (let z = 12; z > 12 - SPAN; z -= z > -50 ? 0.8 : 1.8) down.push(z);
    down.push(12 - SPAN);
    const points = new Float32Array(across.length * down.length * 3);
    const normals = new Float32Array(points.length);
    const faces: number[] = [];
    down.forEach((z, row) => {
      across.forEach((x, column) => {
        const at = (row * across.length + column) * 3;
        points[at] = x;
        points[at + 2] = z;
        normals[at + 1] = 1;
        if (row === 0 || column === 0) return;
        const here = row * across.length + column;
        const back = here - across.length;
        faces.push(back - 1, back, here - 1, back, here, here - 1);
      });
    });
    const sheet = shape(new THREE.BufferGeometry());
    sheet.setAttribute("position", new THREE.BufferAttribute(points, 3));
    sheet.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    sheet.setIndex(faces);
    const soil = keep(new THREE.MeshLambertMaterial());
    soil.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, lie);
      shader.vertexShader = `
        uniform float travelled;
        uniform vec4 gaps[${OPENINGS}];
        ${RAGGED}
        varying vec2 vGround;
        varying float vAlong;
        // How high the ground is at a place on the road: nearly level where the feet go, with
        // two worn ruts, rising to a bank at the path's edge and rolling on under the trees.
        float bumps(vec2 p) {
          float out_ = smoothstep(${(EDGE - 0.6).toFixed(2)}, ${(EDGE + 2.2).toFixed(2)}, abs(p.x));
          float rough = 0.05 * sin(p.x * 1.9 + p.y * 0.55) * sin(p.y * 0.8 - p.x * 0.4)
            + 0.03 * sin(p.y * 2.3 + p.x * 3.1);
          float ruts = -0.06 * exp(-pow((abs(p.x) - 1.6) * 1.5, 2.0)) * (0.6 + 0.4 * sin(p.y * 0.3));
          float bank = out_ * (0.16 + 0.1 * sin(p.y * 0.7 + p.x) + 0.08 * sin(p.x * 0.5 + p.y * 0.23));
          return rough + ruts + bank;
        }
        ${shader.vertexShader}`
        .replace(
          "#include <beginnormal_vertex>",
          `vec2 ground = vec2(position.x, position.z - travelled);
          // The ground comes level to the lip of a river or a ravine.
          float level = 1.0;
          for (int i = 0; i < ${OPENINGS}; i++) {
            float off = max(
              position.z - gaps[i].x,
              gaps[i].y - gaps[i].w * ragged(position.x, gaps[i].z) - position.z);
            level = min(level, smoothstep(0.2, 3.2, off));
          }
          float high = bumps(ground) * level;
          vec3 objectNormal = normalize(vec3(
            (bumps(ground - vec2(0.3, 0.0)) - bumps(ground + vec2(0.3, 0.0))) * level * 1.6,
            0.6,
            (bumps(ground - vec2(0.0, 0.3)) - bumps(ground + vec2(0.0, 0.3))) * level * 1.6));`,
        )
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = vec3(position.x, high, position.z);
          vGround = ground;
          vAlong = position.z;`,
        );
      shader.fragmentShader = `
        uniform sampler2D earthMap;
        uniform sampler2D floorMap;
        uniform vec4 gaps[${OPENINGS}];
        ${RAGGED}
        varying vec2 vGround;
        varying float vAlong;
        ${shader.fragmentShader}`
        .replace(
          "#include <map_fragment>",
          `for (int i = 0; i < ${OPENINGS}; i++)
            if (vAlong < gaps[i].x && vAlong > gaps[i].y - gaps[i].w * ragged(vGround.x, gaps[i].z)) discard;
          vec2 g = vGround;
          // The path's edge wanders, and leaves have drifted over it in places.
          float wander = sin(g.y * 0.9) * 0.5 + sin(g.y * 2.3 + 1.7) * 0.25 + sin(g.y * 0.23) * 0.6
            + sin(g.y * 5.1 + g.x * 2.0) * 0.12;
          float wild = smoothstep(${(EDGE + 0.1).toFixed(2)}, ${(EDGE + 1.5).toFixed(2)}, abs(g.x) + wander * 0.55);
          float litter = smoothstep(0.55, 0.9, sin(g.x * 0.9 + sin(g.y * 0.31) * 2.0) * sin(g.y * 0.43 + g.x * 0.2));
          vec3 trodden = texture2D(earthMap, g / 3.2).rgb;
          // Paler where it is worn down the middle of each lane, darker and damp in the ruts.
          trodden *= 0.82 + 0.3 * sin(g.x * 0.37 + sin(g.y * 0.13) * 1.5) * sin(g.y * 0.21)
            - 0.25 * exp(-pow((abs(g.x) - 1.6) * 1.5, 2.0));
          vec3 leafy = texture2D(floorMap, g / 4.0).rgb;
          vec3 base = mix(trodden, leafy * 1.3, max(wild, litter * 0.45));
          // Puddles lie in the low places and show the moon.
          float puddle = smoothstep(0.9, 0.93, sin(g.x * 1.3 + 2.0 * sin(g.y * 0.17)) * sin(g.y * 0.41 + g.x * 0.5))
            * (1.0 - wild);
          base = mix(base, vec3(0.002, 0.006, 0.01), puddle);
          diffuseColor.rgb = base;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `float shine = smoothstep(0.8, 1.0, sin(g.x * 7.0 + g.y * 2.0) * sin(g.y * 9.0 - g.x * 3.0));
          totalEmissiveRadiance += vec3(0.3, 0.42, 0.6) * puddle * (0.012 + 0.2 * shine);`,
        );
    };
    const ground = add(new THREE.Mesh(sheet, soil));
    ground.frustumCulled = false;
  }
  /**
   * Scenery that stands where a river or a ravine crosses is not drawn: the forest is cut right
   * through, and the moon comes down into the cut. The gap plants its own trees along both its
   * banks, so that what is seen down the cut is the forest's face and never its inside.
   */
  const cleared = <T extends THREE.Material>(material: T): T => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.gaps = openings;
      shader.vertexShader = `uniform vec4 gaps[${OPENINGS}];
        ${RAGGED}
        ${shader.vertexShader}`.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vec4 rooted = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          for (int i = 0; i < ${OPENINGS}; i++)
            if (rooted.z < gaps[i].x + 1.8
              && rooted.z > gaps[i].y - gaps[i].w * ragged(rooted.x, gaps[i].z) - 1.8)
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        #endif`,
      );
    };
    return material;
  };
  /** The same for a single thing that stands in the forest by itself and is no part of a gap. */
  const alone = <T extends THREE.Material>(material: T): T => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.gaps = openings;
      shader.vertexShader = `uniform vec4 gaps[${OPENINGS}];
        ${shader.vertexShader}`.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 rooted = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        for (int i = 0; i < ${OPENINGS}; i++)
          if (rooted.z < gaps[i].x + 2.5 && rooted.z > gaps[i].y - gaps[i].w * 3.0 - 2.5)
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,
      );
    };
    return material;
  };

  // Fireflies drift about the path. They are carried past and come round again in the shader.
  const FIREFLIES = 170;
  const flies = shape(new THREE.BufferGeometry());
  {
    const next = random(11);
    const points = new Float32Array(FIREFLIES * 3);
    const phases = new Float32Array(FIREFLIES);
    for (let index = 0; index < FIREFLIES; index += 1) {
      points[index * 3] = (next() - 0.5) * 26;
      points[index * 3 + 1] = 0.4 + next() * 5;
      points[index * 3 + 2] = next() * 110;
      phases[index] = next() * 6.283;
    }
    flies.setAttribute("position", new THREE.BufferAttribute(points, 3));
    flies.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    // They are placed in the shader, so the box three.js would cull them by is meaningless.
    flies.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  }
  const drift = { distance: { value: 0 }, time: { value: 0 }, scale: { value: 1 } };
  const glimmer = keep(
    new THREE.ShaderMaterial({
      uniforms: drift,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float phase;
        uniform float distance;
        uniform float time;
        uniform float scale;
        varying float glow;
        void main() {
          vec3 place = position;
          place.z = mod(place.z + distance, 110.0) - 104.0;
          place.x += sin(time * 0.7 + phase) * 0.6;
          place.y += sin(time * 0.9 + phase * 1.7) * 0.35;
          vec4 seen = modelViewMatrix * vec4(place, 1.0);
          gl_Position = projectionMatrix * seen;
          glow = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * 2.1 + phase * 3.0), 3.0);
          gl_PointSize = scale * (0.03 + 0.04 * glow) / max(1.0, -seen.z);
        }`,
      fragmentShader: `
        varying float glow;
        void main() {
          float away = length(gl_PointCoord - 0.5) * 2.0;
          float light = pow(max(0.0, 1.0 - away), 2.2);
          gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * light * glow * 1.6, light * glow);
        }`,
    }),
  );
  add(new THREE.Points(flies, glimmer)).frustumCulled = false;

  // Eyes watch from between the trees: pairs of small lights, low down or up in the branches,
  // that are there for a while, blink, and are gone. And leaves come drifting down.
  {
    const next = random(13);
    const PAIRS = 16;
    const points = new Float32Array(PAIRS * 2 * 3);
    const phases = new Float32Array(PAIRS * 2);
    const hues = new Float32Array(PAIRS * 2);
    for (let pair = 0; pair < PAIRS; pair += 1) {
      const x = (next() < 0.5 ? -1 : 1) * (EDGE + 3 + next() * 10);
      const y = next() < 0.7 ? 0.5 + next() * 1.6 : 5 + next() * 6;
      const z = next() * 110;
      const apart = 0.1 + next() * 0.07;
      const phase = next() * 6.283;
      const hue = next();
      for (const eye of [0, 1]) {
        points.set([x + (eye ? apart : -apart), y, z], (pair * 2 + eye) * 3);
        phases[pair * 2 + eye] = phase;
        hues[pair * 2 + eye] = hue;
      }
    }
    const pairs = shape(new THREE.BufferGeometry());
    pairs.setAttribute("position", new THREE.BufferAttribute(points, 3));
    pairs.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    pairs.setAttribute("hue", new THREE.BufferAttribute(hues, 1));
    pairs.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const watching = keep(
      new THREE.ShaderMaterial({
        uniforms: { ...drift, gaps: openings },
        vertexShader: `
          attribute float phase;
          attribute float hue;
          uniform float distance;
          uniform float time;
          uniform float scale;
          uniform vec4 gaps[${OPENINGS}];
          varying float warm;
          void main() {
            vec3 place = position;
            place.z = mod(place.z + distance, 110.0) - 104.0;
            vec4 seen = modelViewMatrix * vec4(place, 1.0);
            gl_Position = projectionMatrix * seen;
            // There for a while and then not, and blinking now and then while they are.
            float there = step(0.1, sin(time * 0.31 + phase))
              * step(0.06, abs(sin(time * 0.83 + phase * 5.0)));
            for (int i = 0; i < ${OPENINGS}; i++)
              if (place.z < gaps[i].x + 3.0 && place.z > gaps[i].y - gaps[i].w * 3.0 - 3.0)
                there = 0.0;
            if (there < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            warm = hue;
            gl_PointSize = scale * 0.075 / max(1.0, -seen.z);
          }`,
        fragmentShader: `
          varying float warm;
          void main() {
            vec2 from = gl_PointCoord - 0.5;
            // An eye is wider than it is tall.
            if (length(vec2(from.x, from.y * 1.7)) > 0.5) discard;
            gl_FragColor = vec4(mix(vec3(1.0, 0.72, 0.18), vec3(0.6, 1.0, 0.45), step(0.5, warm)), 1.0);
          }`,
      }),
    );
    add(new THREE.Points(pairs, watching)).frustumCulled = false;

    const LEAVES = 46;
    const spots = new Float32Array(LEAVES * 3);
    const turns = new Float32Array(LEAVES);
    for (let leaf = 0; leaf < LEAVES; leaf += 1) {
      spots.set([(next() - 0.5) * 24, next() * 13, next() * 110], leaf * 3);
      turns[leaf] = next() * 6.283;
    }
    const litter = shape(new THREE.BufferGeometry());
    litter.setAttribute("position", new THREE.BufferAttribute(spots, 3));
    litter.setAttribute("phase", new THREE.BufferAttribute(turns, 1));
    litter.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const drifting = keep(
      new THREE.ShaderMaterial({
        uniforms: drift,
        vertexShader: `
          attribute float phase;
          uniform float distance;
          uniform float time;
          uniform float scale;
          varying float turn;
          void main() {
            vec3 place = position;
            place.z = mod(place.z + distance, 110.0) - 104.0;
            place.y = mod(place.y - time * (0.55 + 0.3 * sin(phase * 3.0)), 13.0) + 0.1;
            place.x += sin(time * 1.3 + phase) * 0.7 + sin(time * 0.37 + phase * 2.0) * 0.5;
            vec4 seen = modelViewMatrix * vec4(place, 1.0);
            gl_Position = projectionMatrix * seen;
            turn = time * 2.0 + phase;
            gl_PointSize = scale * 0.13 / max(1.0, -seen.z);
          }`,
        fragmentShader: `
          varying float turn;
          void main() {
            vec2 from = gl_PointCoord - 0.5;
            // A leaf, turning over as it falls.
            vec2 leaf = vec2(from.x * cos(turn) - from.y * sin(turn), from.x * sin(turn) + from.y * cos(turn));
            if (length(vec2(leaf.x, leaf.y * 2.4)) > 0.5) discard;
            gl_FragColor = vec4(0.2, 0.33, 0.13, 1.0);
          }`,
      }),
    );
    add(new THREE.Points(litter, drifting)).frustumCulled = false;
  }
  // Bats cross the moon now and then: two dark wings, far off.
  const wing = shape(new THREE.BufferGeometry());
  wing.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 1, 0.25, 0, 0.55, -0.3, 0, 0, 0, 0, 0.55, -0.3, 0, 0.1, -0.35, 0],
      3,
    ),
  );
  const dusk = keep(
    new THREE.MeshBasicMaterial({ color: "#04070b", fog: false, side: THREE.DoubleSide }),
  );
  const bats = Array.from({ length: 5 }, (_, index) => {
    const bat = add(new THREE.Group());
    const wings = [-1, 1].map((side) => {
      const half = new THREE.Mesh(wing, dusk);
      half.scale.set(side * 1.5, 1.5, 1.5);
      bat.add(half);
      return half;
    });
    return { bat, wings, phase: index * 2.7 + 0.4, rate: 0.085 + index * 0.013 };
  });

  // The rope: one vine, from the canopy down to the hands that hold it over a river.
  const rope = add(
    new THREE.Mesh(
      shape(new THREE.CylinderGeometry(0.045, 0.06, 1, 8)),
      keep(new THREE.MeshLambertMaterial({ color: "#5d7a2c" })),
    ),
  );
  rope.visible = false;

  // Models arrive together; nothing is built until all of them have.
  const models = new Map<ModelName, Model>();
  const chunks: THREE.Group[] = [];
  let live = true;
  let give: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    give = resolve;
    fail = reject;
  });
  const timeout = window.setTimeout(() => fail(new Error("Timed out")), LOAD_TIMEOUT_MS);
  const loader = new GLTFLoader();

  /** Bakes a loaded model into pieces standing on the ground, centred and one unit tall. */
  function standard(root: THREE.Object3D): Model {
    root.updateMatrixWorld(true);
    const pieces: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (material) pieces.push({ geometry, material });
    });
    const box = new THREE.Box3();
    for (const piece of pieces) {
      piece.geometry.computeBoundingBox();
      if (piece.geometry.boundingBox) box.union(piece.geometry.boundingBox);
    }
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const fit = new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z);
    const scale = 1 / Math.max(size.y, 1e-6);
    fit.premultiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    for (const piece of pieces) {
      piece.geometry.applyMatrix4(fit);
      piece.geometry.computeBoundingSphere();
      geometries.push(piece.geometry);
      // Matte and cheap to shade: nothing here should shine, and a forest is a great many
      // pixels drawn over one another. Leaves on see-through cards are cut out, not blended,
      // which is by far the costliest thing a forest can ask of a phone.
      const given = piece.material as THREE.MeshStandardMaterial;
      const material = cleared(
        new THREE.MeshLambertMaterial({
          map: given.map,
          color: given.color,
          vertexColors: given.vertexColors,
          side: given.side,
          alphaTest: given.transparent || given.alphaTest > 0 ? 0.5 : 0,
        }),
      );
      given.dispose();
      piece.material = material;
      materials.push(material);
      if (material.map) textures.push(material.map);
    }
    return { parts: pieces, wide: size.x * scale, deep: size.z * scale };
  }

  /** One copy of a model as its own object, to be placed and sized by its group. */
  function single(name: ModelName): THREE.Group {
    const group = new THREE.Group();
    for (const part of models.get(name)?.parts ?? [])
      group.add(new THREE.Mesh(part.geometry, part.material));
    return group;
  }
  /** A model placed so that it is `height` tall, or `width` across, standing at a spot. */
  function stand(
    name: ModelName,
    at: { x: number; y?: number; z?: number },
    size: { height?: number; width?: number; depth?: number; turn?: number },
  ): THREE.Group {
    const model = models.get(name);
    const object = single(name);
    if (!model) return object;
    const height = size.height ?? (size.width ?? 1) / model.wide;
    object.scale.set(
      size.width === undefined ? height : size.width / model.wide,
      height,
      size.depth === undefined ? height : size.depth / model.deep,
    );
    object.rotation.y = size.turn ?? 0;
    object.position.set(at.x, at.y ?? 0, at.z ?? 0);
    return object;
  }

  /**
   * Many copies of one model in a stretch of forest, drawn together. They are put in a shuffled
   * order, so drawing only the first so many thins the forest evenly.
   */
  const thinnable: Array<{ mesh: THREE.InstancedMesh; all: number }> = [];
  function scatter(into: THREE.Group, name: ModelName, places: readonly THREE.Matrix4[]) {
    const next = random(places.length * 31 + name.length);
    const order = places
      .map((place) => ({ place, key: next() }))
      .sort((a, b) => a.key - b.key)
      .map(({ place }) => place);
    // A tree's bark is one of the forest's shades; its leaves are as they come.
    const woody = name === "treeA" || name === "treeB" || name === "treeC";
    const tints = order.map((_, index) => SHADES[shadeOf(index + places.length)] as THREE.Color);
    for (const part of models.get(name)?.parts ?? [])
      copies(
        into,
        part.geometry,
        part.material,
        order,
        woody && part.material.alphaTest === 0 ? tints : undefined,
      );
  }
  /** `tints` colours each copy; copies that are not to be thinned out are always all drawn. */
  function copies(
    into: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    places: readonly THREE.Matrix4[],
    tints?: readonly THREE.Color[],
    thin = true,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, places.length);
    places.forEach((place, index) => {
      mesh.setMatrixAt(index, place);
      const tint = tints?.[index];
      if (tint) mesh.setColorAt(index, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Copies are spread over the whole stretch: the one model's own bounds say nothing.
    mesh.frustumCulled = false;
    into.add(mesh);
    if (thin) thinnable.push({ mesh, all: places.length });
    return mesh;
  }

  const shaft = shape(new THREE.PlaneGeometry(1, 1));
  const beam = keep(
    new THREE.MeshBasicMaterial({
      color: "#9fc8ff",
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  // A giant's trunk: wide at the foot, 26 units to where the canopy hides the rest.
  const bole = shape(new THREE.CylinderGeometry(0.75, 1.25, 26, 9, 1, true).translate(0, 13, 0));
  const barkMap = mottled(64, 9, (noise, speck) => {
    const tone = 0.5 + noise * 0.55 + (speck > 0.85 ? 0.12 : 0);
    return [0.42 * tone, 0.3 * tone, 0.21 * tone];
  });
  barkMap.repeat.set(3, 9);
  textures.push(barkMap);
  // Bark is dark, and no two trunks are quite the same: each is one of a few shades of it,
  // greyer, redder or mossier than the next, and none of them pale.
  const SHADES = ["#f2ece6", "#d6cdc4", "#c9b8a8", "#b6b3b0", "#bcc4ad", "#a89888", "#dcc3ac"].map(
    (shade) => new THREE.Color(shade),
  );
  /** The shade of a thing that is always the same for the same number. */
  const shadeOf = (seed: number) => Math.floor(random(seed * 7 + 3)() * SHADES.length);
  const bark = cleared(keep(new THREE.MeshLambertMaterial({ map: barkMap })));
  // The same bark seen from either side, for thin things, and on things that stand in a gap.
  const barkBoth = cleared(
    keep(new THREE.MeshLambertMaterial({ map: barkMap, side: THREE.DoubleSide })),
  );
  const barkOpen = keep(new THREE.MeshLambertMaterial({ map: barkMap }));
  const canopyDark = keep(new THREE.MeshLambertMaterial({ color: "#06180f" }));
  // Leaves in deep shade: the same clump, dark green and unlit by the moon, so that from below
  // or far off it is foliage and not a pale boulder.
  let shaded: THREE.MeshLambertMaterial | null = null;
  const shadow = (leaf: THREE.Material) => {
    if (!shaded) {
      shaded = cleared(keep((leaf as THREE.MeshLambertMaterial).clone()));
      shaded.color = new THREE.Color("#3d6b47");
      shaded.emissive = new THREE.Color("#0a2414");
    }
    return shaded;
  };

  // The leafy part of each tree model, to be hung in the air as a crown without its trunk:
  // where its middle is and how wide it is, for a model one unit tall. Leaves seen from below
  // are in their own shade, so each gets a little light of its own: a canopy, not a black lid.
  interface Leafage {
    readonly geometry: THREE.BufferGeometry;
    readonly material: THREE.Material;
    readonly middle: THREE.Vector3;
    readonly width: number;
  }
  let leafage: Leafage[] | null = null;
  function crownsOf(): Leafage[] {
    if (leafage) return leafage;
    leafage = (["treeA", "treeB", "treeC"] as const).flatMap((name) =>
      (models.get(name)?.parts ?? []).flatMap((part) => {
        const given = part.material as THREE.MeshLambertMaterial;
        if (given.alphaTest === 0) return [];
        const material = cleared(keep(given.clone()));
        material.emissive = new THREE.Color("#0f3019");
        part.geometry.computeBoundingBox();
        const box = part.geometry.boundingBox ?? new THREE.Box3();
        const size = box.getSize(new THREE.Vector3());
        return [
          {
            geometry: part.geometry,
            material,
            middle: box.getCenter(new THREE.Vector3()),
            width: Math.max(size.x, size.z, 1e-6),
          },
        ];
      }),
    );
    return leafage;
  }

  // Far beyond the last trunks, the forest goes on as a wall of shadowy trunks and leaves.
  const beyond = (() => {
    const next = random(21);
    const [wide, high] = [256, 128];
    const data = new Uint8Array(wide * high * 4);
    const trunkAt = Array.from({ length: wide }, () => next());
    for (let x = 0; x < wide; x += 1) {
      for (let y = 0; y < high; y += 1) {
        const up = y / high;
        const column = Math.floor(x / 5);
        const isTrunk = (trunkAt[column] ?? 0) > 0.62 && x % 5 < 2 + ((column * 7) % 3);
        const clump = Math.sin(x * 0.19 + Math.sin(y * 0.23) * 2) * Math.sin(y * 0.31 + x * 0.07);
        const leafy = up > 0.25 && clump + next() * 0.5 > 0.35;
        const tone = isTrunk ? 0.5 : leafy ? 1.25 : 0.85;
        const index = (y * wide + x) * 4;
        data[index] = 255 * 0.035 * tone;
        data[index + 1] = 255 * (0.1 + 0.05 * up) * tone;
        data[index + 2] = 255 * 0.09 * tone;
        data[index + 3] = 255;
      }
    }
    const map = new THREE.DataTexture(data, wide, high);
    map.wrapS = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = map.minFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    return map;
  })();
  textures.push(beyond);
  beyond.repeat.set((CHUNK * CHUNKS) / 60, 1);
  const wall = keep(new THREE.MeshBasicMaterial({ map: beyond }));
  for (const side of [-1, 1]) {
    const far = add(new THREE.Mesh(shape(new THREE.PlaneGeometry(CHUNK * CHUNKS, 50)), wall));
    far.position.set(side * (EDGE + 40), 25, -(CHUNK * CHUNKS) / 2 + 12);
    far.rotation.y = -side * (Math.PI / 2);
  }

  // What grows on the giants and between them, each made once and copied about. Every copy is
  // rooted at its own tree, so that a river or a ravine takes tree and all away together.
  const UP = new THREE.Vector3(0, 1, 0);
  const ACROSS = new THREE.Vector3(1, 0, 0);
  const limbShape = shape(new THREE.CylinderGeometry(0.55, 1, 1, 7).translate(0, 0.5, 0));
  // A buttress root: a thin fin, one unit out from the middle of its trunk and one unit up it.
  const finShape = shape(new THREE.BufferGeometry());
  {
    const STEPS = 6;
    const points: number[] = [];
    const uvs: number[] = [];
    const faces: number[] = [];
    for (const side of [-1, 1])
      for (let step = 0; step <= STEPS; step += 1) {
        const out = step / STEPS;
        const high = (1 - out) ** 2.4;
        const thick = 0.1 * (1 - out) * side;
        points.push(out, high, thick * 0.4, out, 0, thick);
        uvs.push(out * 0.3, high * 0.25, out * 0.3, 0);
      }
    for (const half of [0, 1])
      for (let step = 0; step < STEPS; step += 1) {
        const at = (half * (STEPS + 1) + step) * 2;
        faces.push(at, at + 1, at + 2, at + 2, at + 1, at + 3);
      }
    finShape.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    finShape.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    finShape.setIndex(faces);
    finShape.computeVertexNormals();
  }
  // A liana slung between two places one unit apart, sagging one unit.
  const sagShape = shape(
    new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.5, -2, 0),
        new THREE.Vector3(1, 0, 0),
      ),
      12,
      0.03,
      5,
    ),
  );
  const cordShape = shape(new THREE.CylinderGeometry(0.04, 0.05, 1, 5).translate(0, -0.5, 0));
  const liana = cleared(keep(new THREE.MeshLambertMaterial({ color: "#4d5a2c" })));
  // A termites' nest: a dark lump of earth stuck to a trunk.
  const nestShape = shape(new THREE.IcosahedronGeometry(1, 1));
  {
    const next = random(57);
    const at = nestShape.attributes.position as THREE.BufferAttribute;
    // Corners that share a place must move together, or the lump comes apart.
    const moved = new Map<string, number>();
    for (let index = 0; index < at.count; index += 1) {
      const key = `${at.getX(index).toFixed(3)},${at.getY(index).toFixed(3)},${at.getZ(index).toFixed(3)}`;
      const swell = moved.get(key) ?? 0.75 + next() * 0.5;
      moved.set(key, swell);
      at.setXYZ(index, at.getX(index) * swell, at.getY(index) * swell, at.getZ(index) * swell);
    }
    nestShape.computeVertexNormals();
  }
  const nest = cleared(
    keep(new THREE.MeshLambertMaterial({ color: "#5a3d28", flatShading: true })),
  );
  // A spray of orchids: a few pale flowers of five petals, drooping from where they grow.
  const orchidShape = shape(new THREE.BufferGeometry());
  {
    const next = random(63);
    const points: number[] = [];
    for (let flower = 0; flower < 5; flower += 1) {
      const middle = new THREE.Vector3(flower * 0.22 - 0.1, -flower * flower * 0.05, 0.15);
      const facing = new THREE.Euler((next() - 0.5) * 1.2, (next() - 0.5) * 1.2, next() * 6);
      for (let petal = 0; petal < 5; petal += 1) {
        const turn = (petal / 5) * 6.283;
        for (const [angle, long] of [
          [0, 0],
          [turn - 0.34, 0.16],
          [turn + 0.34, 0.16],
        ] as const) {
          const corner = new THREE.Vector3(Math.cos(angle) * long, Math.sin(angle) * long, 0)
            .applyEuler(facing)
            .add(middle);
          points.push(corner.x, corner.y, corner.z);
        }
      }
    }
    orchidShape.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    orchidShape.computeVertexNormals();
  }
  const orchid = cleared(
    keep(
      new THREE.MeshLambertMaterial({
        color: "#cdbcd8",
        emissive: "#2a2033",
        side: THREE.DoubleSide,
      }),
    ),
  );
  // A spider's web: spokes and rings of thread, one unit from its middle, catching the moon.
  const webShape = shape(new THREE.BufferGeometry());
  {
    const next = random(71);
    const SPOKES = 11;
    const points: number[] = [];
    const reach = Array.from({ length: SPOKES }, () => 0.8 + next() * 0.2);
    const spoke = (index: number, share: number) => {
      const turn = ((index % SPOKES) / SPOKES) * 6.283;
      const long = (reach[index % SPOKES] ?? 1) * share;
      return [Math.cos(turn) * long, Math.sin(turn) * long, 0] as const;
    };
    for (let index = 0; index < SPOKES; index += 1) {
      points.push(0, 0, 0, ...spoke(index, 1.15));
      for (let ring = 1; ring <= 6; ring += 1)
        points.push(...spoke(index, ring / 6.4), ...spoke(index + 1, (ring + 0.5) / 6.4));
    }
    webShape.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  }
  const web = alone(
    keep(
      new THREE.LineBasicMaterial({
        color: "#cfe2ff",
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    ),
  );
  // Mist lying low over the ground in patches, thickest in the middle of each.
  const lowMist = keep(
    new THREE.ShaderMaterial({
      uniforms: { tint: { value: (scene.fog as THREE.Fog).color } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 across;
        void main() {
          across = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 tint;
        varying vec2 across;
        void main() {
          float thick = max(0.0, 1.0 - dot(across, across));
          gl_FragColor = vec4(tint * 1.9, thick * thick * 0.3);
        }`,
    }),
  );
  // Moths flutter in the moonbeams: points placed in their shader.
  const pulse = { time: { value: 0 }, scale: { value: 1 } };
  const moths = keep(
    new THREE.ShaderMaterial({
      uniforms: pulse,
      vertexShader: `
        attribute float phase;
        uniform float time;
        uniform float scale;
        void main() {
          vec3 place = position + vec3(
            sin(time * 3.1 + phase * 7.0) * 0.5 + sin(time * 0.7 + phase) * 0.6,
            sin(time * 4.3 + phase * 3.0) * 0.35 + sin(time * 0.5 + phase * 2.0) * 0.8,
            cos(time * 2.7 + phase * 5.0) * 0.5);
          vec4 seen = modelViewMatrix * vec4(place, 1.0);
          gl_Position = projectionMatrix * seen;
          gl_PointSize = scale * (0.05 + 0.03 * sin(time * 23.0 + phase * 9.0)) / max(1.0, -seen.z);
        }`,
      fragmentShader: `
        void main() {
          if (length(gl_PointCoord - 0.5) > 0.5) discard;
          gl_FragColor = vec4(0.78, 0.84, 0.74, 1.0);
        }`,
    }),
  );

  function forest(index: number): THREE.Group {
    const group = new THREE.Group();
    const next = random(101 + index * 17);
    const places = new Map<ModelName, THREE.Matrix4[]>();
    const put = (name: ModelName, x: number, y: number, z: number, height: number, lean = 0) => {
      const place = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler((next() - 0.5) * lean, next() * Math.PI * 2, (next() - 0.5) * lean),
        ),
        new THREE.Vector3(height, height * (0.9 + next() * 0.2), height),
      );
      const list = places.get(name) ?? [];
      list.push(place);
      places.set(name, list);
    };
    const pick = <T>(choices: readonly T[]) => choices[Math.floor(next() * choices.length)] as T;
    const masses: THREE.Matrix4[] = [];
    /** A rounded mass of leaves, wider than it is tall. */
    const shades: THREE.Matrix4[] = [];
    const mass = (x: number, y: number, z: number, size: number, squash: number, into = masses) => {
      into.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, next() * 6, 0)),
          new THREE.Vector3(size * (1 + next() * 0.5), size * squash, size * (1 + next() * 0.5)),
        ),
      );
    };
    /** The same, in deep shade: what fills the forest's depths. */
    const shade = (x: number, y: number, z: number, size: number, squash: number) =>
      mass(x, y, z, size, squash, shades);
    /** The giants: where each stands, its shade of bark, and whether it lines the path. */
    const trunks: Array<{ place: THREE.Matrix4; tint: THREE.Color; lining: boolean }> = [];
    /** What grows on them, by its shape: where each copy is, and its tree's shade of bark. */
    const grown = new Map<
      THREE.BufferGeometry,
      { material: THREE.Material; places: THREE.Matrix4[]; tints: THREE.Color[] }
    >();
    const grow = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      place: THREE.Matrix4,
      tint?: THREE.Color,
    ) => {
      const list = grown.get(geometry) ?? { material, places: [], tints: [] };
      list.places.push(place);
      if (tint) list.tints.push(tint);
      grown.set(geometry, list);
    };
    /** Something one unit long, laid from one place to another. */
    const span = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      along: THREE.Vector3,
      thick: (long: number) => THREE.Vector3,
    ) => {
      const way = to.clone().sub(from);
      const long = way.length();
      return new THREE.Matrix4().compose(
        from,
        new THREE.Quaternion().setFromUnitVectors(along, way.normalize()),
        thick(long),
      );
    };
    const crowns = new Map<Leafage, THREE.Matrix4[]>();
    /** A crown of leaves hung with its middle at a place, so wide. */
    const crown = (x: number, y: number, z: number, width: number) => {
      const kinds = crownsOf();
      const kind = kinds[Math.floor(next() * kinds.length)];
      if (!kind) return;
      const scale = width / kind.width;
      const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, next() * 6, 0));
      const middle = kind.middle.clone().multiplyScalar(scale).applyQuaternion(turn);
      const list = crowns.get(kind) ?? [];
      list.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x - middle.x, y - middle.y, z - middle.z),
          turn,
          new THREE.Vector3(scale, scale * (0.8 + next() * 0.3), scale),
        ),
      );
      crowns.set(kind, list);
    };
    const trunk = (x: number, z: number, girth: number, crowned: boolean) => {
      // A giant's own crown, spreading about the top of its trunk.
      if (crowned)
        crown(x + (next() - 0.5) * 3, 25 + next() * 4, z + (next() - 0.5) * 3, 11 + next() * 6);
      const tint = SHADES[Math.floor(next() * SHADES.length)] as THREE.Color;
      trunks.push({
        place: new THREE.Matrix4().compose(
          new THREE.Vector3(x, 0, z),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler((next() - 0.5) * 0.08, next() * 6, (next() - 0.5) * 0.08),
          ),
          new THREE.Vector3(girth, 1, girth),
        ),
        tint,
        lining: crowned,
      });
      return tint;
    };
    /** Buttress roots flaring from a giant's foot, none of them out onto the path. */
    const buttress = (x: number, z: number, girth: number, tint: THREE.Color, most: number) => {
      const fins = most - Math.floor(next() * 2);
      const first = next() * 6.283;
      for (let fin = 0; fin < fins; fin += 1) {
        const turn = first + (fin / fins) * 6.283 + (next() - 0.5) * 0.6;
        const out = 1.25 * girth + 1.1 + next() * 1.9;
        if (Math.abs(x + Math.cos(turn) * out) < EDGE + 0.5) continue;
        grow(
          finShape,
          barkBoth,
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, -0.2, z),
            new THREE.Quaternion().setFromAxisAngle(UP, -turn),
            new THREE.Vector3(out, 3 + next() * 4.5, 0.9 + girth),
          ),
          tint,
        );
      }
    };
    /** Where a giant's limb over the path starts and ends, for what is slung between them. */
    const limbs: Array<{ from: THREE.Vector3; to: THREE.Vector3; side: number }> = [];
    const webs: THREE.Vector3[] = [];
    /** Everything a giant by the path carries: roots, a limb out over the path, and its guests. */
    const dress = (x: number, z: number, girth: number, tint: THREE.Color, side: number) => {
      buttress(x, z, girth, tint, 5);
      /** A place on its bark, on the side the path is, so high. */
      const onBark = (high: number, round = (next() - 0.5) * 1.8) => {
        const out = girth * (1.25 - (0.5 * high) / 26);
        return {
          at: new THREE.Vector3(x - side * Math.cos(round) * out, high, z + Math.sin(round) * out),
          facing: Math.atan2(-side * Math.cos(round), Math.sin(round)),
        };
      };
      if (next() < 0.3) {
        const { at } = onBark(2.6 + next() * 4.5);
        const size = 0.38 + next() * 0.3;
        grow(
          nestShape,
          nest,
          new THREE.Matrix4().compose(
            at,
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, next() * 6, 0)),
            new THREE.Vector3(size, size * 1.55, size),
          ),
        );
      }
      for (let count = 0; count < 2; count += 1) {
        if (next() < 0.45) continue;
        const { at, facing } = onBark(2.4 + next() * 6);
        const size = 0.4 + next() * 0.35;
        grow(
          orchidShape,
          orchid,
          new THREE.Matrix4().compose(
            at,
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing, (next() - 0.5) * 0.6)),
            new THREE.Vector3(size, size, size),
          ),
        );
      }
      if (next() < 0.3) {
        const { at } = onBark(3 + next() * 9);
        put("bromeliad", at.x, at.y - 0.15, at.z, 0.7 + next() * 0.5, 0.5);
      }
      if (webs.length < 2 && Math.abs(x) > EDGE + 3.6 && next() < 0.4)
        webs.push(new THREE.Vector3(x - side * (1.25 * girth + 1), 2 + next() * 2.4, z));
      if (next() < 0.25) return;
      // A great limb reaches out over the path and ends in leaves.
      const high = 9 + next() * 6;
      const from = new THREE.Vector3(x, high, z);
      const to = new THREE.Vector3(
        -side * next() * EDGE * 0.9,
        high + 1.5 + next() * 3,
        z + (next() - 0.5) * 2.4,
      );
      const thick = 0.3 + 0.25 * girth;
      grow(
        limbShape,
        bark,
        span(from, to, UP, (long) => new THREE.Vector3(thick, long, thick)),
        tint,
      );
      crown(to.x, to.y + 1, to.z, 5 + next() * 3);
      limbs.push({ from, to, side });
      const along = (share: number) => from.clone().lerp(to, share);
      // A smaller one forks off it, upwards.
      const fork = along(0.45 + next() * 0.2);
      const tip = fork
        .clone()
        .add(new THREE.Vector3((next() - 0.5) * 4, 2.5 + next() * 2, (next() - 0.5) * 5));
      grow(
        limbShape,
        bark,
        span(fork, tip, UP, (long) => new THREE.Vector3(thick * 0.5, long, thick * 0.5)),
        tint,
      );
      // Its leaves are a plain clump: real crowns are kept for where they are seen most.
      mass(tip.x, tip.y + 0.4, tip.z, 2.2 + next() * 1.2, 0.6);
      // Lianas hang from it, never lower than is clear of a head, and loop along under it.
      for (let count = 0; count < 4; count += 1) {
        const top = along(0.3 + next() * 0.65);
        const long = Math.min(top.y - CLEAR_HEIGHT - 0.3, 1.5 + next() * 5);
        if (long < 1 || next() < 0.25) continue;
        grow(
          cordShape,
          liana,
          new THREE.Matrix4().compose(
            top,
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler((next() - 0.5) * 0.12, 0, (next() - 0.5) * 0.12),
            ),
            new THREE.Vector3(0.7 + next() * 0.7, long, 0.7 + next() * 0.7),
          ),
        );
      }
      if (next() < 0.7) {
        const [a, b] = [along(0.15 + next() * 0.25), along(0.65 + next() * 0.3)];
        const sag = Math.min(a.y - CLEAR_HEIGHT - 0.5, 1.2 + next() * 1.8);
        grow(
          sagShape,
          liana,
          span(a, b, ACROSS, (long) => new THREE.Vector3(long, sag, sag)),
        );
      }
      if (next() < 0.35) {
        const perch = along(0.25 + next() * 0.5);
        put("bromeliad", perch.x, perch.y + thick * 0.55, perch.z, 0.7 + next() * 0.5, 0.3);
      }
    };

    for (const side of [-1, 1]) {
      // Giants close by the path, and rank behind rank of them further in. Between the first
      // rank and the second a way is left clear, half way up, for what flies there.
      for (let along = 2; along < CHUNK; along += 4.2 + next() * 3) {
        const x = side * (EDGE + 2.4 + next() * 2.8);
        const girth = 0.5 + next() * 0.45;
        dress(x, -along, girth, trunk(x, -along, girth, true), side);
      }
      for (let along = 0; along < CHUNK; along += 2.6 + next() * 2) {
        const x = side * (EDGE + 11.5 + next() * 8);
        const girth = 0.5 + next() * 0.6;
        buttress(x, -along, girth, trunk(x, -along, girth, false), 4);
      }
      for (let along = 0; along < CHUNK; along += 1.9 + next() * 1.6) {
        trunk(side * (EDGE + 20 + next() * 17), -along, 0.6 + next() * 0.9, false);
      }
      // Between the trunks the forest is leaves from the floor up: thickets low down, and
      // masses of foliage hanging at every height above them. Nothing shows through.
      for (let along = 0; along < CHUNK; along += 1.5 + next() * 1.2) {
        const size = 3 + next() * 3.6;
        mass(side * (EDGE + 5 + next() * 26), size * 0.28, -along, size, 0.62);
      }
      // Above the thickets, dark masses of leaves at every height, kept back from the path's
      // edge half way up, where the serpent flies. Real leafy crowns are costly to draw, so
      // they are kept for where they are seen close: here it is depth that is wanted.
      for (let along = 0; along < CHUNK; along += 1.6 + next() * 1.3) {
        const size = 4.5 + next() * 4.5;
        shade(side * (EDGE + 13 + next() * 22), 5 + next() * 9, -along, size, 0.55);
      }
      for (let along = 0; along < CHUNK; along += 1.8 + next() * 1.4) {
        const size = 5 + next() * 5;
        shade(side * (EDGE + 9 + next() * 26), 14 + next() * 9, -along, size, 0.5);
      }
      for (let along = 3; along < CHUNK; along += 9 + next() * 5) {
        crown(side * (EDGE + 5 + next() * 5), 15 + next() * 5, -along, 9 + next() * 5);
      }
      // Big ferns and broad leaves further in, where the edge's undergrowth leaves off.
      for (let along = 0; along < CHUNK; along += 2.8 + next() * 2.6) {
        put(
          pick(["fern", "plantBig", "plantBig", "plant"] as const),
          side * (EDGE + 3.4 + next() * 7),
          0,
          -along,
          2 + next() * 2.2,
          0.3,
        );
      }
      // Leafy trees of an ordinary size among them.
      for (let along = 4; along < CHUNK; along += 8 + next() * 5) {
        put(
          pick(["treeC", "treeA", "treeB"] as const),
          side * (EDGE + (next() < 0.4 ? 3 + next() * 2.5 : 12.5 + next() * 9)),
          -0.2,
          -along,
          7 + next() * 4,
          0.1,
        );
      }
      // Palms and banana plants fill the middle height between floor and crowns.
      for (let along = 1; along < CHUNK; along += 7 + next() * 5) {
        put(
          pick(["palm", "palm", "banana"] as const),
          side * (EDGE + 1.4 + next() * 3.2),
          0,
          -along,
          4.5 + next() * 4,
          0.25,
        );
      }
      // Undergrowth crowds the edge of the path and spills a little over it.
      for (let along = 0; along < CHUNK; along += 1 + next() * 1) {
        put(
          // Mostly the plain cheap kinds; the showy ones now and then.
          pick([
            "fern",
            "fern",
            "fern",
            "plant",
            "plant",
            "plantBig",
            "plantBig",
            "bush",
            "bush",
            "monstera",
            "bromeliad",
          ] as const),
          side * (EDGE + 0.7 + next() * next() * 3.4),
          0,
          -along,
          0.8 + next() * 1.6,
          0.3,
        );
      }
      // A few small fungi that glow faintly, low down in the leaf litter.
      for (let count = 0; count < 2; count += 1)
        put(
          "mushrooms",
          side * (EDGE + 0.4 + next() * 1.2),
          0,
          -next() * CHUNK,
          0.22 + next() * 0.2,
        );
    }
    // Now and then a liana is slung right across, high over the path, from a giant on one side
    // to one that stands nearly opposite it.
    for (const left of limbs) {
      if (left.side !== -1) continue;
      const right = limbs.find(
        (limb) => limb.side === 1 && Math.abs(limb.from.z - left.from.z) < 1.6,
      );
      if (!right) continue;
      const [a, b] = [left.from.clone(), right.from.clone()];
      a.y += 3 + next() * 3;
      b.y += 3 + next() * 3;
      const sag = 2 + next() * 2;
      grow(
        sagShape,
        liana,
        span(a, b, ACROSS, (long) => new THREE.Vector3(long, sag, sag)),
      );
    }
    for (const [name, list] of places) scatter(group, name, list);
    scatter(group, "bush", masses);
    const clump = models.get("bush")?.parts[0];
    if (clump) copies(group, clump.geometry, shadow(clump.material), shades);
    // The giants that line the path are always all there, with everything they carry. The
    // ranks behind are laid nearest first, so thinning takes the furthest.
    const lining = trunks.filter((giant) => giant.lining);
    const behind = trunks
      .filter((giant) => !giant.lining)
      .sort((a, b) => Math.abs(a.place.elements[12] ?? 0) - Math.abs(b.place.elements[12] ?? 0));
    for (const [rank, thin] of [
      [lining, false],
      [behind, true],
    ] as const)
      copies(
        group,
        bole,
        bark,
        rank.map((giant) => giant.place),
        rank.map((giant) => giant.tint),
        thin,
      );
    for (const [geometry, { material, places, tints }] of grown)
      copies(group, geometry, material, places, tints.length > 0 ? tints : undefined, false);
    for (const at of webs) {
      const threads = new THREE.LineSegments(webShape, web);
      threads.position.copy(at);
      threads.scale.setScalar(0.9 + next() * 0.5);
      threads.rotation.set((next() - 0.5) * 0.3, (next() - 0.5) * 0.5, next() * 6);
      group.add(threads);
    }
    // Mist lies low in patches, across the path and off among the trees.
    for (let count = 0; count < 6; count += 1) {
      const patch = new THREE.Mesh(flat, lowMist);
      patch.rotation.x = -Math.PI / 2;
      patch.scale.set(14 + next() * 14, 8 + next() * 8, 1);
      patch.position.set((next() - 0.5) * 44, 0.4 + next() * 0.5, -next() * CHUNK);
      patch.renderOrder = 1;
      group.add(patch);
    }

    // The crowns meet over the path as well, leaving gaps of sky for the moon to come through:
    // lit leaves lowest, and darkness above them.
    for (let along = 0; along < CHUNK; along += 4.5 + next() * 3) {
      crown((next() - 0.5) * 22, 16.5 + next() * 5, -along, 10 + next() * 6);
    }
    for (const [kind, places] of crowns) copies(group, kind.geometry, kind.material, places);
    const leaves = models.get("bush")?.parts[0];
    for (let along = 0; along < CHUNK; along += 6 + next() * 4) {
      const roof = new THREE.Mesh(leaves?.geometry, canopyDark);
      const size = 12 + next() * 8;
      roof.scale.set(size * 1.7, size * 0.4, size * 1.4);
      roof.position.set((next() - 0.5) * 40, 27 + next() * 6, -along);
      roof.rotation.y = next() * 6;
      group.add(roof);
    }
    for (let count = 0; count < 3; count += 1) {
      const light = new THREE.Mesh(shaft, beam);
      light.scale.set(2 + next() * 3.5, 30, 1);
      light.position.set((next() - 0.35) * 16, 13, -next() * CHUNK);
      // Slanting down from the moon's side.
      light.rotation.set(0, (next() - 0.5) * 0.8, 0.38 + next() * 0.12);
      group.add(light);
      // Moths flutter in it.
      const MOTHS = 7;
      const places = new Float32Array(MOTHS * 3);
      const phases = new Float32Array(MOTHS);
      const down = new THREE.Vector3(0, -1, 0).applyEuler(light.rotation);
      for (let moth = 0; moth < MOTHS; moth += 1) {
        const at = light.position.clone().addScaledVector(down, 3 + next() * 8);
        places.set([at.x, at.y, at.z], moth * 3);
        phases[moth] = next() * 6.283;
      }
      const swarm = new THREE.BufferGeometry();
      swarm.setAttribute("position", new THREE.BufferAttribute(places, 3));
      swarm.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
      swarm.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      geometries.push(swarm);
      const fluttering = new THREE.Points(swarm, moths);
      fluttering.frustumCulled = false;
      group.add(fluttering);
    }
    return group;
  }

  Promise.all(
    (Object.keys(MODELS) as ModelName[]).map(async (name) => {
      const loaded = await loader.loadAsync(MODELS[name]);
      return [name, loaded.scene] as const;
    }),
  ).then(
    (loaded) => {
      window.clearTimeout(timeout);
      if (!live) return;
      for (const [name, root] of loaded) models.set(name, standard(root));
      // The forest's glowing fungi are small and pale, with a faint green light of their own.
      for (const part of models.get("mushrooms")?.parts ?? []) {
        const material = part.material as THREE.MeshLambertMaterial;
        material.color = new THREE.Color("#b9c7a4");
        material.emissive = new THREE.Color("#4fc25a");
        material.emissiveIntensity = 0.4;
      }
      for (let index = 0; index < CHUNKS; index += 1) chunks.push(add(forest(index)));
      give();
    },
    () => {
      window.clearTimeout(timeout);
      fail(new Error("A model failed to load"));
    },
  );

  // The river: dark moving water in a channel below the road, with the moon broken up on it,
  // heaving a little, and white where it runs against its banks.
  const flow = { time: { value: 0 } };
  const water = keep(
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, flow]),
      fog: true,
      vertexShader: `
        uniform float time;
        varying vec3 place;
        varying float shore;
        varying float heave;
        #include <fog_pars_vertex>
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          // How far this is from the nearer edge of the channel.
          shore = (0.5 - abs(uv.y - 0.5)) * length(modelMatrix[1].xyz);
          heave = sin(world.x * 0.9 + time * 1.7 + sin(world.z * 0.7 + time * 0.6) * 1.2) * 0.6
            + sin(world.x * 2.1 - world.z * 1.3 + time * 2.4) * 0.4;
          world.y += heave * 0.09;
          place = world.xyz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float time;
        varying vec3 place;
        varying float shore;
        varying float heave;
        #include <fog_pars_fragment>
        void main() {
          // The current runs across the path, from the right bank to the left.
          vec2 at = vec2(place.x + time * 1.4, place.z);
          float swell = sin(at.x * 0.55 + sin(at.y * 0.8 + time) * 1.3) * 0.5 + 0.5;
          float ripple = sin(at.x * 2.3 + at.y * 1.1 + time * 2.0)
            * sin(at.x * 1.1 - at.y * 2.7 - time * 1.4);
          vec3 colour = mix(vec3(0.015, 0.07, 0.1), vec3(0.05, 0.24, 0.31), swell);
          // Lit on the faces that heave up towards the moon, darker in the troughs.
          colour *= 0.8 + 0.35 * heave;
          // Moonlight on the crests, thickest in the moon's own path down the water.
          float track = exp(-pow((place.x + 6.0) * 0.16, 2.0));
          // Long thin glints lying across the current, not round spots.
          float streak = sin(at.x * 0.9 + sin(at.y * 5.0 + time * 1.7) * 1.6 + time * 1.1)
            * sin(at.y * 7.0 + at.x * 0.35 - time * 0.9);
          float crest = smoothstep(0.72, 0.98, streak) + 0.35 * smoothstep(0.8, 1.0, ripple);
          colour += vec3(0.62, 0.78, 1.0) * crest * (0.18 + 0.75 * track);
          // Flecks of froth carried down on the current.
          float fleck = smoothstep(0.93, 1.0, sin(at.x * 3.1 + sin(at.y * 2.0) * 2.0) * sin(at.y * 4.7 + at.x * 0.6));
          colour += vec3(0.5, 0.6, 0.62) * fleck * 0.5;
          // Broken white along the banks, where the water is thrown back.
          float lap = shore - 1.75 + 0.3 * sin(at.x * 1.7 + time * 1.3) + 0.15 * sin(at.x * 4.3 - time * 2.1);
          float froth = smoothstep(0.75, 0.0, lap)
            * (0.35 + 0.65 * smoothstep(-0.2, 0.5, sin(at.x * 6.0 + time * 2.0) * sin(at.y * 5.0 + at.x)));
          colour = mix(colour, vec3(0.52, 0.66, 0.7), froth * 0.7);
          gl_FragColor = vec4(colour, 1.0);
          #include <fog_fragment>
        }`,
    }),
  );
  // Fine enough across the current for the heave to show against the banks and the stones.
  const sheetOfWater = shape(new THREE.PlaneGeometry(1, 1, 110, 12));
  const flat = shape(new THREE.PlaneGeometry(1, 1));
  // What an obstacle's moving parts do from moment to moment, by the obstacle they belong to.
  const alive = new Map<THREE.Object3D, ReadonlyArray<(time: number, distance: number) => void>>();
  const strand = shape(new THREE.CylinderGeometry(0.055, 0.07, 1, 7));
  const creeper = keep(
    new THREE.MeshLambertMaterial({ color: "#8fbf4a", emissive: "#27400f", emissiveIntensity: 1 }),
  );
  const ring = shape(new THREE.TorusGeometry(0.2, 0.05, 8, 20));
  const bright = keep(new THREE.MeshBasicMaterial({ color: "#f3ffc4" }));
  const glint = keep(
    new THREE.MeshBasicMaterial({
      color: "#dcff9a",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  // Fallen wood is bark like any other, in the same few shades.
  const woodMap = mottled(64, 13, (noise, speck) => {
    const tone = 0.55 + noise * 0.5 + (speck > 0.88 ? 0.1 : 0);
    return [0.42 * tone, 0.3 * tone, 0.21 * tone];
  });
  woodMap.repeat.set(2, 7);
  textures.push(woodMap);
  // A little light of its own keeps the underside of a bough overhead from going black.
  const woods = SHADES.map((color) =>
    keep(new THREE.MeshLambertMaterial({ map: woodMap, color, emissive: "#130d08" })),
  );
  // A tree that is coming down is seen from underneath, in its own shade, and so are the boughs
  // in a ravine's wall: they have a little light of their own.
  const deadwoods = SHADES.map((color) =>
    keep(new THREE.MeshLambertMaterial({ map: woodMap, color, emissive: "#1c140c" })),
  );
  const heartwood = keep(new THREE.MeshLambertMaterial({ color: "#d9b27a" }));
  // A unit trunk lying along x: one unit long and one in radius, a little thinner at one end.
  const round = shape(new THREE.CylinderGeometry(1, 0.88, 1, 16, 1, true).rotateZ(Math.PI / 2));
  const stub = shape(new THREE.CylinderGeometry(0.5, 0.75, 1, 7).translate(0, 0.5, 0));
  // A standing trunk one unit tall and one in radius at its foot, to be felled.
  const tapered = shape(new THREE.CylinderGeometry(0.62, 1, 1, 14).translate(0, 0.5, 0));
  /**
   * A fallen trunk, round and whole: bark, a pale cut face at each end, the stumps of broken
   * boughs, and small things growing on it.
   */
  function fallen(length: number, radius: number, seed: number): THREE.Group {
    const next = random(seed);
    const wood = woods[shadeOf(seed)] as THREE.Material;
    const trunk = new THREE.Group();
    const bole = new THREE.Mesh(round, wood);
    bole.scale.set(length, radius, radius);
    trunk.add(bole);
    for (const side of [-1, 1]) {
      const face = new THREE.Mesh(disc, heartwood);
      face.scale.setScalar(radius * (side === 1 ? 1 : 0.88));
      face.position.x = (side * length) / 2;
      face.rotation.y = (side * Math.PI) / 2;
      trunk.add(face);
    }
    for (let count = 0; count < 3; count += 1) {
      const knot = new THREE.Mesh(stub, wood);
      knot.scale.set(radius * 0.32, radius * (0.9 + next() * 1.3), radius * 0.32);
      knot.position.set((next() - 0.5) * length * 0.7, radius * 0.7, 0);
      // Up and a little to either side: never down, where it would lower what must be cleared.
      knot.rotation.set((next() - 0.5) * 1.6, 0, (next() - 0.5) * 0.9);
      trunk.add(knot);
    }
    for (let count = 0; count < 2; count += 1)
      trunk.add(
        stand(
          next() < 0.5 ? "fern" : "bromeliad",
          { x: (next() - 0.5) * length * 0.6, y: radius * 0.9 },
          { height: 0.45 + next() * 0.4, turn: next() * 6 },
        ),
      );
    // Small glowing fungi grow out of the rotting wood.
    for (let count = 0; count < 1; count += 1) {
      const round = (next() - 0.5) * 1.6;
      trunk.add(
        stand(
          "mushrooms",
          {
            x: (next() - 0.5) * length * 0.7,
            y: Math.cos(round) * radius * 0.9,
            z: Math.sin(round) * radius * 0.9,
          },
          { height: 0.16 + next() * 0.14, turn: next() * 6 },
        ),
      );
    }
    return trunk;
  }

  // The edge of a river or a ravine: a strip of ground running right across the forest that
  // starts on the level, rolls over a lip and goes down. A few are made and shared. Each lies
  // with the level ground towards the view; the far side is the same thing turned about.
  interface Layer {
    /** How far back from the edge (or out over it, below zero), and how high. */
    readonly back: number;
    readonly high: number;
    /** How far the edge wanders in and out along its length, and how broken it is. */
    readonly wander: number;
    readonly broken: number;
    readonly colour: string;
    /** On a far side: how far buttresses of it stand out over the gap, out in the forest. */
    readonly bulge?: number;
  }
  /** A far side is ragged: `phase` says which ragged line it follows, as far as `reach`. */
  function edging(
    seed: number,
    layers: readonly Layer[],
    far?: { phase: number; reach: number },
  ): THREE.BufferGeometry {
    const next = random(seed);
    const phases = Array.from({ length: 4 }, () => next() * 6.283);
    const across: number[] = [];
    for (let x = -56; x <= 56.001; x += 0.8) across.push(x);
    const points: number[] = [];
    const colours: number[] = [];
    const faces: number[] = [];
    const tint = new THREE.Color();
    layers.forEach((layer, row) => {
      across.forEach((x, column) => {
        const along = x + row * 3.7;
        const sway =
          Math.sin(along * 0.31 + (phases[0] ?? 0)) * 0.5 +
          Math.sin(along * 0.83 + (phases[1] ?? 0)) * 0.3 +
          Math.sin(along * 1.9 + (phases[2] ?? 0)) * 0.2;
        // Buttresses stand out below the lip: a little where the road is, so that nothing
        // falling past is seen to go through one, and a long way to either side.
        const beside = Math.min(1, Math.max(0, (Math.abs(x) - EDGE) / 6));
        const buttress =
          (layer.bulge ?? 0) *
          (0.2 + 0.8 * beside) *
          Math.max(
            0,
            Math.sin(x * 0.19 + row * 1.3 + (phases[3] ?? 0)) * Math.sin(x * 0.07 + row * 0.9) +
              0.2,
          );
        points.push(
          x + (next() - 0.5) * layer.broken,
          layer.high + (next() - 0.5) * layer.broken,
          layer.back +
            (far ? far.reach * ragged(x, far.phase) - (far ? buttress : 0) : 0) +
            layer.wander * (0.5 + 0.5 * sway) +
            (next() - 0.5) * layer.broken,
        );
        tint.set(layer.colour).multiplyScalar(0.75 + next() * 0.5);
        colours.push(tint.r, tint.g, tint.b);
        if (row === 0 || column === 0) return;
        const here = row * across.length + column;
        const before = here - across.length;
        faces.push(before - 1, here - 1, before, before, here - 1, here);
      });
    });
    const strip = shape(new THREE.BufferGeometry());
    strip.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    strip.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    strip.setIndex(faces);
    strip.computeVertexNormals();
    return strip;
  }
  // A river's bank: earth, then wet mud down to the water and under it.
  const SHORE: readonly Layer[] = [
    { back: 1.5, high: -0.08, wander: 0, broken: 0, colour: "#3a2a1b" },
    { back: 0.45, high: 0.13, wander: 0, broken: 0.08, colour: "#3d2c1c" },
    { back: -0.1, high: 0.07, wander: -0.35, broken: 0.1, colour: "#33261a" },
    { back: -0.7, high: -0.45, wander: -0.4, broken: 0.12, colour: "#241b13" },
    { back: -1.35, high: WATER_LEVEL + 0.02, wander: -0.5, broken: 0.1, colour: "#17120d" },
    { back: -2.6, high: WATER_LEVEL - 0.7, wander: 0, broken: 0, colour: "#0b0d0d" },
  ];
  // A ravine's wall: a lip of earth and stone that overhangs, then broken rock in bands going
  // down and down until it is lost in the dark. There is no bottom to be seen.
  const CLIFF: readonly Layer[] = [
    { back: 1.5, high: -0.08, wander: 0, broken: 0, colour: "#3a2a1b" },
    { back: 0.45, high: 0.14, wander: 0, broken: 0.1, colour: "#4a3a28" },
    { back: -0.15, high: 0.1, wander: -0.55, broken: 0.16, colour: "#6f6657" },
    { back: 0.25, high: -0.8, wander: -0.3, broken: 0.35, colour: "#57503f" },
    { back: 0.1, high: -2.4, wander: -0.9, broken: 0.9, colour: "#3b3a33", bulge: 1.4 },
    { back: 0.7, high: -4.6, wander: -1.1, broken: 1.1, colour: "#4f4b3e", bulge: 2.6 },
    { back: 0.2, high: -7.4, wander: -1.2, broken: 1.2, colour: "#33383a", bulge: 3.2 },
    { back: 0.5, high: -11, wander: -0.8, broken: 1.2, colour: "#262d30", bulge: 2.4 },
    { back: 0.3, high: -16, wander: -1, broken: 1.4, colour: "#1a2327", bulge: 2.8 },
    { back: 0.6, high: -23, wander: -1, broken: 1.5, colour: "#111a1e", bulge: 2 },
    { back: 0.2, high: -33, wander: 0, broken: 1, colour: "#0a1216" },
    { back: 0.3, high: -RAVINE.depth, wander: 0, broken: 0, colour: "#060c10" },
  ];
  /** The ragged lines a far side may follow. A few of each kind of edge are made, and shared. */
  const LINES = [1.1, 3.7, 5.9] as const;
  const edges = {
    river: {
      near: LINES.map((_, index) => edging(31 + index, SHORE)),
      far: LINES.map((phase, index) => edging(34 + index, SHORE, { phase, reach: RECESS.river })),
    },
    ravine: {
      near: LINES.map((_, index) => edging(41 + index, CLIFF)),
      far: LINES.map((phase, index) => edging(44 + index, CLIFF, { phase, reach: RECESS.ravine })),
    },
  };
  const stone = keep(
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );
  // The dark a ravine goes down into.
  const haze = keep(new THREE.MeshBasicMaterial({ color: "#060c10", fog: false }));
  const root = keep(new THREE.MeshLambertMaterial({ color: "#4a3524" }));

  // A hollow trunk lying along the road, in eight staves so that it can burst. Each stave is
  // bark outside and dark heartwood inside, and they share their shapes.
  const STAVES = 8;
  const pithMap = mottled(64, 17, (noise, speck) => {
    const tone = 0.35 + noise * 0.9 + (speck > 0.9 ? 0.25 : 0);
    return [0.2 * tone, 0.12 * tone, 0.07 * tone];
  });
  pithMap.repeat.set(1, 5);
  textures.push(pithMap);
  // Dark, with a little light of its own: inside a trunk there is not much of the moon's.
  const pith = keep(new THREE.MeshLambertMaterial({ map: pithMap, emissive: "#140b06" }));
  // An old trunk is not a pipe: its girth swells and narrows along it, its section is lumpy,
  // its bark is ridged, it spreads into roots at its far end, and its mouth is broken off
  // unevenly. Inside it is ribbed, and nowhere lower than its roof is said to be.
  const staves = Array.from({ length: STAVES }, (_, index) => {
    const points: number[] = [];
    const uvs: number[] = [];
    const faces: number[] = [];
    const AROUND = 5;
    const ALONG = 16;
    const groups: number[] = [];
    /** A place on the trunk: `turn` round it, `v` of the way along, in or out. */
    const place = (turn: number, v: number, inner: boolean) => {
      const far = v * 10;
      const swell = inner
        ? 1 +
          0.07 * (0.5 + 0.5 * Math.sin(far * 4.3)) +
          0.05 * (0.5 + 0.5 * Math.sin(3 * turn + 1.3 * far))
        : (1.06 - 0.1 * v) *
            (1 +
              0.09 * Math.sin(3 * turn + 1.3 * far) +
              0.06 * Math.sin(5 * turn - 2.1 * far + 1) +
              0.04 * Math.sin(2 * turn + 0.7 * far + 2) +
              0.025 * Math.sin(13 * turn + far)) +
          // Roots, where it stood.
          0.45 * Math.max(0, (v - 0.86) / 0.14) ** 2 * (0.55 + 0.45 * Math.sin(4 * turn + 1));
      const radius = (inner ? TRUNK.inner : TRUNK.outer) * swell;
      // Broken off unevenly at the mouth, never forward of where the mouth is said to be.
      const broken =
        v === 0 ? 0.014 * (1.1 + Math.sin(5 * turn + 1) * 0.6 + Math.sin(11 * turn) * 0.5) : 0;
      points.push(Math.cos(turn) * radius * TRUNK.wide, Math.sin(turn) * radius, -v - broken);
      uvs.push(((turn / (Math.PI * 2)) * STAVES) % 1.0001, v);
    };
    const turnAt = (step: number) => ((index + step / AROUND) / STAVES) * Math.PI * 2;
    for (const inner of [false, true]) {
      const first = points.length / 3;
      const from = faces.length;
      for (let ring = 0; ring <= ALONG; ring += 1)
        for (let step = 0; step <= AROUND; step += 1) {
          place(turnAt(step), ring / ALONG, inner);
          if (ring === 0 || step === 0) continue;
          const here = first + ring * (AROUND + 1) + step;
          const back = here - (AROUND + 1);
          if (inner) faces.push(back - 1, back, here - 1, back, here, here - 1);
          else faces.push(back - 1, here - 1, back, back, here - 1, here);
        }
      groups.push(from, faces.length - from);
    }
    // The broken end of the wood itself, between bark and hollow, at the mouth.
    const first = points.length / 3;
    const from = faces.length;
    for (let step = 0; step <= AROUND; step += 1) {
      place(turnAt(step), 0, true);
      place(turnAt(step), 0, false);
      if (step === 0) continue;
      const here = first + step * 2;
      faces.push(here - 2, here - 1, here + 1, here - 2, here + 1, here);
    }
    groups.push(from, faces.length - from);
    const stave = shape(new THREE.BufferGeometry());
    stave.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    stave.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    stave.setIndex(faces);
    for (let group = 0; group < 3; group += 1)
      stave.addGroup(groups[group * 2] ?? 0, groups[group * 2 + 1] ?? 0, group);
    stave.computeVertexNormals();
    const middle = ((index + 0.5) / STAVES) * Math.PI * 2;
    return { stave, out: new THREE.Vector2(Math.cos(middle), Math.sin(middle)) };
  });
  // Moonlight through the cracks in its roof, seen from inside.
  const crack = keep(new THREE.MeshBasicMaterial({ color: "#cfe6ff", fog: false }));
  /** How high the middle of a hollow trunk is: its roof inside is just above where a beam's underside is. */
  const TRUNK_MIDDLE = BEAM_UNDERSIDE + 0.05 - TRUNK.inner;
  const BURST_SECONDS = 0.65;
  /**
   * A hollow trunk `length` long, its mouth at the origin. `owner` is the obstacle it belongs
   * to: when that says the character has struck it, it bursts into its staves.
   */
  function hollow(owner: THREE.Object3D, length: number, seed: number) {
    const next = random(seed);
    const wood = woods[shadeOf(seed)] as THREE.Material;
    const trunk = new THREE.Group();
    // Everything that is on it or in it, and goes when it bursts.
    const whole = new THREE.Group();
    const top = TRUNK_MIDDLE + TRUNK.outer * 0.95;
    for (let count = 0; count < 2 + length / 6; count += 1)
      whole.add(
        stand(
          (["fern", "bromeliad", "plant"] as const)[Math.floor(next() * 3)] ?? "fern",
          { x: (next() - 0.5) * 1, y: top, z: -length * (0.08 + next() * 0.8) },
          { height: 0.45 + next() * 0.6, turn: next() * 6 },
        ),
      );
    for (let count = 0; count < 1 + length / 12; count += 1) {
      const side = next() < 0.5 ? -1 : 1;
      const round = 0.5 + next() * 0.7;
      whole.add(
        stand(
          "mushrooms",
          {
            x: side * Math.sin(round) * TRUNK.outer * TRUNK.wide,
            y: TRUNK_MIDDLE + Math.cos(round) * TRUNK.outer,
            z: -length * (0.04 + next() * 0.9),
          },
          { height: 0.2 + next() * 0.16, turn: next() * 6 },
        ),
      );
    }
    // The stumps of its boughs, up and out to either side, never down into anyone's way.
    for (let count = 0; count < 2 + length / 7; count += 1) {
      const knot = new THREE.Mesh(stub, wood);
      const side = next() < 0.5 ? -1 : 1;
      const lean = 0.5 + next() * 0.9;
      knot.scale.set(0.2 + next() * 0.14, 0.6 + next() * 1.5, 0.2 + next() * 0.14);
      knot.position.set(
        side * Math.sin(lean) * TRUNK.outer * TRUNK.wide * 0.9,
        TRUNK_MIDDLE + Math.cos(lean) * TRUNK.outer * 0.9,
        -length * (0.1 + next() * 0.8),
      );
      knot.rotation.set((next() - 0.5) * 0.8, 0, -side * (lean + (next() - 0.5) * 0.4));
      whole.add(knot);
    }
    // Shelves of fungus down its sides.
    for (let count = 0; count < 3 + length / 5; count += 1) {
      const side = next() < 0.5 ? -1 : 1;
      const shelf = new THREE.Mesh(disc, heartwood);
      const size = 0.22 + next() * 0.3;
      shelf.scale.set(size, size * 0.8, 1);
      shelf.rotation.x = -Math.PI / 2;
      shelf.position.set(
        side * TRUNK.outer * TRUNK.wide * (0.98 + next() * 0.06),
        TRUNK_MIDDLE + (next() - 0.3) * 0.8,
        -length * (0.05 + next() * 0.9),
      );
      whole.add(shelf);
    }
    // Cracks in the roof let the moon in: a bright slit overhead and a shaft of light under it.
    for (let count = 0; count < 1 + length / 5; count += 1) {
      const along = -length * (0.12 + next() * 0.8);
      const across = (next() - 0.5) * 0.7;
      const slit = new THREE.Mesh(flat, crack);
      slit.rotation.set(Math.PI / 2, 0, (next() - 0.5) * 0.5);
      slit.scale.set(0.03 + next() * 0.03, 0.5 + next() * 0.8, 1);
      slit.position.set(across, TRUNK_MIDDLE + TRUNK.inner - 0.04, along);
      const light = new THREE.Mesh(shaft, beam);
      light.scale.set(0.16 + next() * 0.16, TRUNK.inner * 1.9, 1);
      light.position.set(across, TRUNK_MIDDLE, along);
      light.rotation.z = (next() - 0.5) * 0.3;
      whole.add(slit, light);
    }
    trunk.add(whole);
    const pieces = staves.map(({ stave, out }) => {
      const piece = new THREE.Group();
      const centre = new THREE.Vector3(
        out.x * TRUNK.wide * 0.9,
        TRUNK_MIDDLE + out.y * 0.9,
        -length / 2,
      );
      piece.position.copy(centre);
      const shell = new THREE.Mesh(stave, [wood, pith, heartwood]);
      shell.scale.z = length;
      shell.position.set(-centre.x, TRUNK_MIDDLE - centre.y, length / 2);
      piece.add(shell);
      trunk.add(piece);
      return {
        piece,
        centre,
        out,
        spin: new THREE.Vector3(next() - 0.5, next() - 0.5, next() - 0.5),
      };
    });
    let burstAt: number | null = null;
    return {
      object: trunk,
      move(time: number) {
        if (!owner.userData.struck) return;
        burstAt ??= time;
        // The staves fly apart, tumbling, and are gone.
        const flown = (time - burstAt) / BURST_SECONDS;
        whole.visible = false;
        for (const { piece, centre, out, spin } of pieces) {
          piece.visible = flown < 1;
          piece.position.set(
            centre.x + out.x * flown * 5,
            centre.y + out.y * flown * 5 - flown * flown * 3,
            centre.z,
          );
          piece.rotation.set(spin.x * flown * 5, spin.y * flown * 5, spin.z * flown * 5);
        }
      },
    };
  }

  // A gap's own forest: the same trees and leaves, standing where the gap says and not taken
  // away by it. Their materials are made when first wanted, once the models are in.
  let dressing: {
    crowns: Array<{ kind: Leafage; material: THREE.Material }>;
    bush: Part;
    shade: THREE.Material;
  } | null = null;
  function dressingOf() {
    const clump = models.get("bush")?.parts[0];
    if (dressing || !clump) return dressing;
    const lit = keep((clump.material as THREE.MeshLambertMaterial).clone());
    const shade = keep(lit.clone());
    shade.color = new THREE.Color("#3d6b47");
    shade.emissive = new THREE.Color("#0a2414");
    dressing = {
      crowns: crownsOf().map((kind) => ({ kind, material: keep(kind.material.clone()) })),
      bush: { geometry: clump.geometry, material: lit },
      shade,
    };
    return dressing;
  }
  // Down the cut the forest's two faces draw together and are lost in mist, sheet behind sheet,
  // with the sky open above.
  const veil = keep(
    new THREE.ShaderMaterial({
      uniforms: { tint: { value: (scene.fog as THREE.Fog).color } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying float high;
        void main() {
          high = uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 tint;
        varying float high;
        void main() {
          gl_FragColor = vec4(tint, 0.44 * (1.0 - smoothstep(0.7, 1.0, high)));
        }`,
    }),
  );
  // A giant water lily's pad: a round leaf lying on the water with its rim turned up.
  const padShape = shape(
    new THREE.LatheGeometry(
      [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.96, 0), new THREE.Vector2(1, 0.1)],
      18,
    ),
  );
  const pad = keep(
    new THREE.MeshLambertMaterial({
      color: "#2f7040",
      emissive: "#0c2a15",
      side: THREE.DoubleSide,
    }),
  );
  const petal = keep(new THREE.MeshLambertMaterial({ color: "#f3ecf7", emissive: "#5d5564" }));

  /**
   * The vine to swing by, hanging over one lane down to where a raised hand reaches. It ends in
   * a loop that catches the moonlight, and that is what says it is there to be taken, and where.
   */
  function hangingVine(lane: number, phase: number) {
    const vine = new THREE.Group();
    const cord = new THREE.Mesh(strand, creeper);
    const top = 16;
    const grip = RAIL_HEIGHT - 0.45;
    cord.scale.set(1, top - grip, 1);
    cord.position.y = (top + grip) / 2;
    const loop = new THREE.Mesh(ring, bright);
    loop.position.y = grip - 0.2;
    const shine = new THREE.Mesh(disc, glint);
    shine.position.set(0, grip - 0.2, 0.05);
    const lit = new THREE.Mesh(shaft, beam);
    lit.scale.set(1.6, 20, 1);
    lit.position.y = 10;
    vine.add(cord, loop, shine, lit);
    vine.position.set(lane * LANE, 0, 0.4);
    return {
      object: vine,
      move(time: number) {
        vine.rotation.z = Math.sin(time * 1.3 + phase) * 0.05;
        shine.scale.setScalar(0.5 + 0.12 * Math.sin(time * 4 + phase));
      },
    };
  }
  /** The rivers and ravines now in the scene, and how long each is. */
  const cuts: Array<{ object: THREE.Object3D; length: number; phase: number; reach: number }> = [];
  const shed = keep(
    new THREE.PointsMaterial({ color: "#6f9440", size: 0.16, sizeAttenuation: true }),
  );

  /** A stump's own materials in each shade of bark, made as they are first wanted. */
  const stumps = new Map<string, THREE.Material>();
  const stumpIn = (shade: number, given: THREE.Material): THREE.Material => {
    const key = `${shade}:${given.uuid}`;
    let made = stumps.get(key);
    if (!made) {
      const tinted = keep((given as THREE.MeshLambertMaterial).clone());
      // The model's wood is darker than the forest's: brought up to it, then shaded.
      tinted.color.multiplyScalar(1.6).multiply(SHADES[shade] as THREE.Color);
      made = tinted;
      stumps.set(key, made);
    }
    return made;
  };
  /** A choice that is always the same for the same obstacle, so nothing flickers between kinds. */
  const choose = <T>(obstacle: Obstacle, salt: number, choices: readonly T[]): T =>
    choices[Math.floor(random(Math.round(obstacle.at * 97) + salt)() * choices.length)] as T;

  function build(obstacle: Obstacle): THREE.Group {
    const object = new THREE.Group();
    if (obstacle.kind === "block") {
      // Something too big to get past, standing in a lane: a giant stump or a boulder.
      obstacle.lanes.forEach((lane, index) => {
        const kind = choose(obstacle, index, ["stump", "rockA", "rockB"] as const);
        const height = kind === "stump" ? 2.3 : 2.1;
        const thing = stand(
          kind,
          { x: lane * LANE },
          { height, width: LANE * 0.86, depth: 1.8, turn: lane },
        );
        // A stump is wood, in one of the forest's shades of it.
        if (kind === "stump") {
          const shade = shadeOf(Math.round(obstacle.at) + index);
          thing.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) mesh.material = stumpIn(shade, mesh.material as THREE.Material);
          });
        }
        object.add(thing);
      });
      return object;
    }
    if (obstacle.kind === "beam") {
      // A fallen tree lodged across the path on rocks at either side, its underside at the
      // height the rule says. A tunnel is one after another.
      for (let count = 0; count < obstacle.beams; count += 1) {
        const along = count * BEAM_SPACING;
        const radius = 0.3;
        const bough = fallen(EDGE * 2 + 4.6, radius, Math.round(obstacle.at) + count);
        bough.position.set(0, BEAM_UNDERSIDE + radius, -along);
        bough.userData.end = along;
        object.add(bough);
        for (const side of [-1, 1]) {
          const rest = stand(
            count % 2 ? "rockB" : "rockA",
            { x: side * (EDGE + 1.5), z: -along },
            { height: BEAM_UNDERSIDE + 0.12, width: 2.3, depth: 1.5, turn: side + count },
          );
          rest.userData.end = along;
          object.add(rest);
        }
      }
      return object;
    }
    if (obstacle.kind === "log") {
      if (choose(obstacle, 0, ["log", "log", "rocks"] as const) === "log") {
        // A great trunk lying right across the path.
        const radius = LOG_HEIGHT * 0.56;
        const log = fallen(EDGE * 2 + 3.4, radius, Math.round(obstacle.at));
        log.position.y = radius * 0.94;
        object.add(log);
        return object;
      }
      // A ridge of rocks from one side of the path to the other.
      const next = random(Math.round(obstacle.at));
      for (let x = -EDGE - 0.6; x < EDGE + 0.6; x += 1.15 + next() * 0.35) {
        object.add(
          stand(
            next() < 0.5 ? "rockA" : "rockB",
            { x, z: (next() - 0.5) * 0.5 },
            { height: LOG_HEIGHT * (0.95 + next() * 0.25), turn: next() * 6 },
          ),
        );
      }
      return object;
    }
    if (obstacle.kind === "monster") {
      // A great one is the anaconda, as long as the path is wide. A small one is a jaguar or a
      // peccary, big for its kind but no wider than its lane.
      const kind =
        obstacle.size === "great"
          ? "anaconda"
          : choose(obstacle, 0, ["jaguar", "peccary"] as const);
      const beast = stand(
        kind,
        { x: obstacle.lane * LANE },
        { height: kind === "anaconda" ? MONSTER.height * 0.8 : kind === "jaguar" ? 1.9 : 1.6 },
      );
      if (kind === "anaconda") {
        // It comes head first, its length trailing away up the road behind it, and it slides.
        beast.rotation.y = SNAKE_FACING;
        const long = (models.get("anaconda")?.wide ?? 1) * beast.scale.x;
        beast.position.z = -long / 2 + 1;
        object.userData.gait = "slide";
      }
      object.add(beast);
      return object;
    }
    if (obstacle.kind === "fall") {
      // A dead giant at the path's edge, tall enough to lie right across the path and into
      // the trees beyond. It starts to go as the player nears and is still coming down as
      // they pass: on the ground at its own side, head high over the middle lane, and just
      // clear of anyone in the far one. It lands behind them.
      const { from } = obstacle;
      const tall = 17.5;
      const foot = 0.72;
      /** How far its foot is beyond the path's edge. */
      const beyond = 1.2;
      const tree = new THREE.Group();
      const deadwood = deadwoods[shadeOf(Math.round(obstacle.at))] as THREE.Material;
      const trunk = new THREE.Mesh(tapered, deadwood);
      trunk.scale.set(foot, tall, foot);
      tree.add(trunk);
      const next = random(Math.round(obstacle.at));
      // Its boughs and what is left of its crown are all at the top, which comes down among
      // the trees on the far side: over the path it is bare.
      for (let count = 0; count < 5; count += 1) {
        const limb = new THREE.Mesh(stub, deadwood);
        limb.scale.set(0.2, 1.4 + next() * 1.6, 0.2);
        limb.position.y = tall * (0.78 + next() * 0.2);
        limb.rotation.set((next() - 0.5) * 1.2, next() * 6, Math.PI / 2 - 0.5 + next());
        tree.add(limb);
      }
      for (let count = 0; count < 5; count += 1)
        tree.add(
          stand(
            "bush",
            { x: (next() - 0.5) * 2.6, y: tall - 3.6 + count * 0.8, z: (next() - 0.5) * 2.6 },
            { height: 2 + next() * 1.4 },
          ),
        );
      tree.position.set(from * (EDGE + beyond), 0, 0);
      object.add(tree);
      // The angle it is at as it passes, measured up from the ground: the one that puts its
      // underside so high over the middle of the middle lane.
      const reach = beyond + 1.5 * LANE;
      const thick = foot * (1 - 0.38 * (reach / tall));
      let passing = Math.atan((FELLING.over + thick) / reach);
      passing = Math.atan((FELLING.over + thick / Math.cos(passing)) / reach);
      // It goes slowly at first and then all at once, as a tree does.
      const whole = FELLING.from + FELLING.lands;
      const gathering = Math.log(1 - passing / (Math.PI / 2)) / Math.log(FELLING.from / whole);
      // Leaves shaken out of its crown as it goes.
      const LEAVES = 40;
      const drops = new Float32Array(LEAVES * 3);
      const seeds = Array.from({ length: LEAVES }, () => [next(), next(), next(), next()] as const);
      const falling = new THREE.BufferGeometry();
      falling.setAttribute("position", new THREE.BufferAttribute(drops, 3));
      falling.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      const shower = new THREE.Points(falling, shed);
      shower.frustumCulled = false;
      shower.visible = false;
      object.add(shower);
      const sway = next() * 6;
      alive.set(object, [
        (time, distance) => {
          const ahead = obstacle.at - distance;
          const gone = Math.min(1, Math.max(0, (FELLING.from - ahead) / whole));
          // Before it goes it stirs, more and more.
          const stir = Math.max(0, 1 - Math.abs(ahead - FELLING.from) / FELLING.from);
          const lean =
            (Math.PI / 2) * gone ** gathering +
            (gone === 0
              ? Math.sin(time * 1.1 + sway) * 0.02 + Math.sin(time * 9) * 0.012 * stir
              : 0);
          tree.rotation.z = from * lean;
          shower.visible = gone > 0 && gone < 1;
          if (!shower.visible) return;
          seeds.forEach(([a, b, c, d], index) => {
            const age = (time * 0.8 + d) % 1;
            // Where in the crown it came from, as the crown is now.
            const up = tall - 3.5 + b * 4;
            const out = (a - 0.5) * 3;
            drops[index * 3] = tree.position.x - from * Math.sin(lean) * up + Math.cos(lean) * out;
            drops[index * 3 + 1] = Math.max(0.05, Math.cos(lean) * up - age * age * 9);
            drops[index * 3 + 2] = (c - 0.5) * 3 + Math.sin(time * 3 + d * 20) * 0.2;
          });
          (falling.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        },
        // The shower's own shape is this tree's alone, and goes with it.
        () => {
          if (!object.parent) falling.dispose();
        },
      ]);
      return object;
    }
    if (obstacle.kind === "trunk") {
      // A great hollow trunk lying along one lane: round it, or through it.
      const pipe = hollow(object, obstacle.length, Math.round(obstacle.at));
      pipe.object.position.x = obstacle.lane * LANE;
      pipe.object.userData.end = obstacle.length;
      object.add(pipe.object);
      alive.set(object, [pipe.move]);
      return object;
    }
    // The ground is broken right across, by a river in its channel or by a ravine, and the
    // forest with it. There is a vine to cross by, or a hollow trunk fallen across, or both.
    const { length, over } = obstacle;
    const next = random(Math.round(obstacle.at));
    const deadwood = deadwoods[shadeOf(Math.round(obstacle.at))] as THREE.Material;
    const moving: Array<(time: number) => void> = [];
    const line = Math.floor(next() * LINES.length);
    const phase = LINES[line] ?? 0;
    const reach = RECESS[over];
    /** How far beyond where the gap is said to end its far edge is, at a place across it. */
    const recess = (x: number) => reach * ragged(x, phase);
    cuts.push({ object, length, phase, reach });
    const near = new THREE.Mesh(edges[over].near[line], stone);
    near.userData.end = 1.5;
    // The far side lies the other way about, and follows its ragged line.
    const beyond = new THREE.Mesh(edges[over].far[line], stone);
    beyond.position.z = -length;
    beyond.scale.z = -1;
    beyond.userData.end = length + reach * 4;
    object.add(near, beyond);
    // Both banks are dressed along the gap's whole length, to either side of the path: giants
    // leaning out over it under their crowns, and leaves from the ground up between them. What
    // is seen down the cut is the face of a forest, not its inside.
    const set = dressingOf();
    const rows = {
      trunks: [] as THREE.Matrix4[],
      tints: [] as THREE.Color[],
      masses: [] as THREE.Matrix4[],
      shades: [] as THREE.Matrix4[],
      crowns: new Map<number, THREE.Matrix4[]>(),
    };
    const leafy = (into: THREE.Matrix4[], x: number, y: number, z: number, size: number) =>
      into.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, next() * 6, 0)),
          new THREE.Vector3(size * (1 + next() * 0.5), size * 0.6, size * (1 + next() * 0.5)),
        ),
      );
    const crowned = (x: number, y: number, z: number, width: number) => {
      if (!set || set.crowns.length === 0) return;
      const which = Math.floor(next() * set.crowns.length);
      const kind = set.crowns[which]?.kind;
      if (!kind) return;
      const scale = width / kind.width;
      const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, next() * 6, 0));
      const middle = kind.middle.clone().multiplyScalar(scale).applyQuaternion(turn);
      const list = rows.crowns.get(which) ?? [];
      list.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x - middle.x, y - middle.y, z - middle.z),
          turn,
          new THREE.Vector3(scale, scale * (0.8 + next() * 0.3), scale),
        ),
      );
      rows.crowns.set(which, list);
    };
    const giant = (x: number, z: number, girth: number, lean: number) => {
      rows.trunks.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, -0.3, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, next() * 6, 0)),
          new THREE.Vector3(girth, 1, girth),
        ),
      );
      rows.tints.push(SHADES[Math.floor(next() * SHADES.length)] as THREE.Color);
    };
    for (const far of [false, true]) {
      // Which way along the road is away from the gap, on this bank.
      const away = far ? -1 : 1;
      for (const side of [-1, 1]) {
        for (let out = EDGE + 2.8 + next() * 1.5; out < 47; out += 3.2 + next() * 2.4) {
          const x = side * out;
          const lip = far ? -length - recess(x) : 0;
          const z = lip + away * (2.2 + next() * 2.4);
          giant(x, z, 0.55 + next() * 0.5, -away * (0.03 + next() * 0.1));
          crowned(
            x + (next() - 0.5) * 3,
            22 + next() * 6,
            z - away * (2 + next() * 2),
            12 + next() * 5,
          );
          if (far || out < 22)
            crowned(
              x + (next() - 0.5) * 4,
              12 + next() * 5,
              z - away * (1 + next() * 1.5),
              8 + next() * 3,
            );
          // Thickets right on the lip, and the forest's own shade close behind the trunks.
          const size = 2.6 + next() * 2;
          leafy(rows.masses, x + (next() - 0.5) * 2, size * 0.25, lip + away * (1 + next()), size);
          for (const high of [4 + next() * 5, 11 + next() * 6, 18 + next() * 5])
            leafy(
              rows.shades,
              x + (next() - 0.5) * 3,
              high,
              z + away * (0.5 + next() * 3),
              5 + next() * 3,
            );
        }
        // The cut's far ends are lost in mist.
        for (const out of [30, 36, 42, 48]) {
          if (far) continue;
          const low = over === "ravine" ? -RAVINE.depth : WATER_LEVEL - 1;
          const sheet = new THREE.Mesh(flat, veil);
          sheet.rotation.y = Math.PI / 2;
          sheet.scale.set(length + reach * 4 + 10, 50 - low, 1);
          sheet.position.set(side * out, (50 + low) / 2, -(length + reach * 4) / 2 + 2);
          sheet.userData.end = length + reach * 4;
          sheet.renderOrder = 2;
          object.add(sheet);
        }
      }
    }
    if (obstacle.vine !== null) {
      // The vine hangs from a great bough that a giant on the near bank holds out over the gap.
      const from = obstacle.vine !== 0 ? Math.sign(obstacle.vine) : next() < 0.5 ? -1 : 1;
      const shade = Math.floor(next() * SHADES.length);
      rows.trunks.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(from * (EDGE + 2.6), -0.3, 1.6),
          new THREE.Quaternion(),
          new THREE.Vector3(0.85, 1, 0.85),
        ),
      );
      rows.tints.push(SHADES[shade] as THREE.Color);
      const start = new THREE.Vector3(from * (EDGE + 2.6), 12.5, 1.6);
      const tip = new THREE.Vector3(obstacle.vine * LANE - from * 1.2, 16.6, 0.2);
      const way = tip.clone().sub(start);
      const bough = new THREE.Mesh(limbShape, woods[shade]);
      bough.position.copy(start);
      bough.scale.set(0.5, way.length(), 0.5);
      bough.quaternion.setFromUnitVectors(UP, way.normalize());
      bough.userData.end = 2;
      object.add(bough);
      crowned(tip.x, tip.y + 1.2, tip.z, 5);
    }
    const spent: THREE.InstancedMesh[] = [];
    /** Copies that belong to this gap alone: they stay as long as it does, and go with it. */
    const planted = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      places: readonly THREE.Matrix4[],
      tints?: readonly THREE.Color[],
    ) => {
      if (places.length === 0) return;
      const mesh = copies(object, geometry, material, places, tints, false);
      mesh.userData.end = length + reach * 4 + 60;
      spent.push(mesh);
    };
    planted(bole, barkOpen, rows.trunks, rows.tints);
    if (set) {
      planted(set.bush.geometry, set.bush.material, rows.masses);
      planted(set.bush.geometry, set.shade, rows.shades);
      for (const [which, places] of rows.crowns) {
        const crown = set.crowns[which];
        if (crown) planted(crown.kind.geometry, crown.material, places);
      }
    }
    /** Something at the far side, `back` beyond its edge there, or on the near lip. */
    const onLip = (far: boolean, thing: THREE.Object3D, back: number) => {
      thing.position.z = far ? -length - recess(thing.position.x) - back : back;
      thing.userData.end = far ? length + reach * 4 : back;
      object.add(thing);
    };
    for (const far of [false, true]) {
      for (let x = -EDGE - 14; x < EDGE + 14; x += 0.9 + next() * 1.4) {
        const onPath = Math.abs(x) < EDGE + 0.3;
        // Low stones on the path itself, so the way stays open; ferns and rocks beside it.
        if (onPath && next() < 0.5) continue;
        const kind = onPath
          ? (["rockA", "rockB"] as const)[Math.floor(next() * 2)]
          : (["plantBig", "fern", "plantBig", "rockA", "rockB"] as const)[Math.floor(next() * 5)];
        onLip(
          far,
          stand(
            kind ?? "fern",
            { x, y: 0.08 },
            { height: onPath ? 0.14 + next() * 0.14 : 0.8 + next() * 1.4, turn: next() * 6 },
          ),
          0.35 + next() * 0.8,
        );
      }
    }
    if (over === "river") {
      const river = new THREE.Mesh(sheetOfWater, water);
      river.rotation.x = -Math.PI / 2;
      // Wide enough to lie under the far bank wherever that is.
      river.scale.set(112, length + 5, 1);
      river.position.set(0, WATER_LEVEL, -(length + 5) / 2);
      river.userData.end = length;
      object.add(river);
      // Stones stand out of it, and the water heaves about them.
      for (let count = 0; count < 7; count += 1) {
        const rock = stand(
          next() < 0.5 ? "rockA" : "rockB",
          {
            x: (next() - 0.5) * EDGE * 5,
            y: WATER_LEVEL - 0.25,
            z: -2 - next() * Math.max(0, length - 4),
          },
          { height: 0.5 + next() * 0.7, turn: next() * 6 },
        );
        rock.userData.end = length;
        object.add(rock);
      }
      // Giant water lilies lie on it, away from where the current runs hardest.
      const pads: THREE.Matrix4[] = [];
      for (let count = 0; count < 16; count += 1) {
        const size = 0.55 + next() * 0.6;
        const x = (next() - 0.5) * 70;
        const z = -1.6 - next() * Math.max(0.5, length - 2.6);
        pads.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x, WATER_LEVEL + 0.1, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, next() * 6, 0)),
            new THREE.Vector3(size, size, size),
          ),
        );
        if (count % 4 !== 0) continue;
        const flower = new THREE.Mesh(nestShape, petal);
        flower.scale.set(0.2, 0.14, 0.2);
        flower.position.set(x + size * 0.5, WATER_LEVEL + 0.22, z + size * 0.4);
        flower.userData.end = length;
        object.add(flower);
      }
      planted(padShape, pad, pads);
      // Caimans lie in it with only their backs and eyes out, turning slowly.
      for (let count = 0; count < 4; count += 1) {
        const low = WATER_LEVEL - 0.2;
        const caiman = stand(
          "caiman",
          { x: (next() - 0.5) * EDGE * 3, y: low, z: -length * (0.2 + next() * 0.6) },
          { height: 0.62, turn: next() * 6 },
        );
        caiman.userData.end = length;
        object.add(caiman);
        const phase = next() * 6;
        const heading = caiman.rotation.y;
        moving.push((time) => {
          caiman.position.y = low + Math.sin(time * 0.9 + phase) * 0.05;
          caiman.rotation.y = heading + Math.sin(time * 0.4 + phase) * 0.25;
        });
      }
      // Piranhas leap clear of the water and fall back.
      for (let count = 0; count < 7; count += 1) {
        const fish = stand(
          "piranha",
          { x: (next() - 0.5) * EDGE * 2.2, y: -2, z: -length * (0.15 + next() * 0.7) },
          { height: 0.42, turn: next() < 0.5 ? 0 : Math.PI },
        );
        fish.userData.end = length;
        object.add(fish);
        const phase = next() * 6;
        const rate = 2.2 + next() * 1.6;
        moving.push((time) => {
          const leap = Math.sin(time * rate + phase);
          fish.position.y = WATER_LEVEL - 0.5 + leap * 1.25;
          fish.rotation.x = -Math.cos(time * rate + phase) * 0.9;
        });
      }
    } else {
      // Far below, where the walls are lost, there is only dark.
      const floor = new THREE.Mesh(flat, haze);
      floor.rotation.x = -Math.PI / 2;
      floor.scale.set(112, length + 30, 1);
      floor.position.set(0, -RAVINE.depth + 0.5, -length / 2);
      floor.userData.end = length + reach * 4;
      object.add(floor);
      // Roots and creepers hang down the far wall from its lip.
      const wide = (x: number) => (Math.abs(x) > EDGE + 14 ? 2.2 : 1);
      for (let x = -EDGE - 32; x < EDGE + 32; x += (1.6 + next() * 3) * wide(x)) {
        const long = 1.5 + next() * 4;
        if (next() < 0.5) {
          onLip(
            true,
            stand(next() < 0.5 ? "vinesA" : "vinesB", { x, y: -long + 0.15 }, { height: long }),
            -0.45,
          );
        } else {
          const dangling = new THREE.Mesh(strand, root);
          dangling.scale.set(1.2, long, 1.2);
          dangling.position.set(x, -long / 2 + 0.1, 0);
          dangling.rotation.z = (next() - 0.5) * 0.3;
          onLip(true, dangling, -0.5);
        }
      }
      // Dead boughs and roots stick out of it, and boulders are lodged in it. Where the road
      // is they keep close to the wall, so that nothing falling past goes through one.
      for (let x = -EDGE - 34; x < EDGE + 34; x += (1.8 + next() * 3.2) * wide(x)) {
        const onPath = Math.abs(x) < EDGE + 1;
        if (next() < 0.3) {
          const boulder = stand(
            next() < 0.5 ? "rockA" : "rockB",
            { x, y: -1.5 - next() * 7 },
            { height: 0.9 + next() * (onPath ? 0.5 : 1.8), turn: next() * 6 },
          );
          onLip(true, boulder, 0.3);
          continue;
        }
        const bough = new THREE.Group();
        const long = onPath ? 1 + next() * 1 : 1.6 + next() * 3.2;
        const limb = new THREE.Mesh(tapered, deadwood);
        limb.scale.set(0.1 + long * 0.035, long, 0.1 + long * 0.035);
        bough.add(limb);
        for (let fork = 0; fork < 2; fork += 1) {
          const twig = new THREE.Mesh(tapered, deadwood);
          twig.scale.set(0.05, long * (0.3 + next() * 0.3), 0.05);
          twig.position.y = long * (0.45 + next() * 0.35);
          twig.rotation.set((next() - 0.5) * 1.6, 0, (next() - 0.5) * 1.8);
          bough.add(twig);
        }
        bough.position.set(x, -0.6 - next() * 8, 0);
        // Out from the wall towards the view and up, and off to one side.
        bough.rotation.set(
          onPath ? 0.3 + next() * 0.3 : 0.5 + next() * 0.8,
          0,
          (next() - 0.5) * (onPath ? 2.2 : 1.4),
        );
        onLip(true, bough, -0.2);
      }
    }
    if (obstacle.vine !== null) {
      const vine = hangingVine(obstacle.vine, next() * 6);
      object.add(vine.object);
      moving.push(vine.move);
    }
    if (obstacle.trunk !== null) {
      // It lies from the near lip to well past the furthest the far one can be, so that both
      // its ends rest on the ground wherever the far edge is.
      const rest = 0.6;
      const span = extent(obstacle);
      const pipe = hollow(object, span + rest, Math.round(obstacle.at) + 1);
      pipe.object.position.set(obstacle.trunk * LANE, 0, rest);
      pipe.object.userData.end = span;
      object.add(pipe.object);
      moving.push(pipe.move);
    }
    // What was made for this gap alone goes with it.
    moving.push(() => {
      if (!object.parent) for (const mesh of spent) mesh.dispose();
    });
    alive.set(object, moving);
    return object;
  }

  let density = 1;
  const boitata = createBoitata(scene);
  const mist = new THREE.Color("#12384a");
  const night = new THREE.Color(NIGHT);
  const ember = new THREE.Color("#6b2a0c");
  let travelled = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const along = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  return {
    ready,
    grip: "rope",
    build,
    update({ distance, now, eyes, hang, hands, running, detail }) {
      // A run that starts over sends the serpent away to begin its visits again.
      if (distance < travelled) boitata.reset();
      travelled = distance;
      const blaze = boitata.update(now, distance, running);
      // Its fire colours the mist and the sky while it is near.
      (scene.fog as THREE.Fog).color.copy(mist).lerp(ember, blaze * 0.55);
      (scene.background as THREE.Color).copy(night).lerp(ember, blaze * 0.3);
      (water.uniforms.time as { value: number }).value = now / 1000;
      for (const [object, moving] of alive) {
        for (const move of moving) move(now / 1000, distance);
        if (!object.parent) alive.delete(object);
      }
      // Where the ground is open now: the furthest ahead first, if there are more than can be told.
      for (let index = cuts.length - 1; index >= 0; index -= 1)
        if (!cuts[index]?.object.parent) cuts.splice(index, 1);
      openings.value.forEach((opening, index) => {
        const cut = cuts[cuts.length - 1 - index];
        if (cut)
          opening.set(
            cut.object.position.z,
            cut.object.position.z - cut.length,
            cut.phase,
            cut.reach,
          );
        else opening.set(NOWHERE, NOWHERE, 0, 0);
      });
      lie.travelled.value = distance;
      // A device that cannot keep up is given the same forest with fewer plants in it.
      if (detail !== density && chunks.length > 0) {
        density = detail;
        for (const { mesh, all } of thinnable) mesh.count = Math.ceil(all * density);
      }
      const span = CHUNK * CHUNKS;
      beyond.offset.x = distance / 60;
      chunks.forEach((chunk, index) => {
        // A stretch goes round only once it is wholly behind the view, and comes back wholly
        // beyond the mist: nothing is ever seen to appear.
        chunk.position.z = ((index * CHUNK + distance) % span) - span + CHUNK + 5;
      });
      drift.distance.value = distance;
      drift.time.value = now / 1000;
      drift.scale.value = innerHeight;
      pulse.time.value = now / 1000;
      pulse.scale.value = innerHeight;
      // The vine runs from the hands up into the canopy ahead, and sways with the swing.
      rope.visible = hang > 0.05 && hands !== null;
      if (hands && rope.visible) {
        anchor.set(hands.x * 0.6, 17, hands.z - 4 + Math.sin(now / 380) * 0.8);
        along.subVectors(anchor, hands);
        const length = along.length();
        rope.position.copy(hands).addScaledVector(along, 0.5);
        rope.scale.set(1, length, 1);
        rope.quaternion.setFromUnitVectors(up, along.normalize());
      }
      moon.position.x = -34 + eyes.x * 0.9;
      for (const { bat, wings, phase, rate } of bats) {
        // Each comes across from one side, dipping and rising, and is a long time coming back.
        const across = ((now / 1000) * rate + phase) % 3;
        const seconds = now / 1000;
        bat.position.set(
          moon.position.x - 30 + across * 60,
          moon.position.y + Math.sin(across * 9 + phase) * 3 + Math.sin(phase * 5) * 4,
          -114,
        );
        bat.visible = across < 1;
        const beat = Math.sin(seconds * 17 + phase) * 0.9;
        wings.forEach((half, side) => {
          half.rotation.z = (side ? 1 : -1) * beat;
        });
      }
    },
    dispose() {
      live = false;
      window.clearTimeout(timeout);
      boitata.dispose();
      for (const object of added) scene.remove(object);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const map of textures) map.dispose();
      scene.fog = null;
      scene.background = null;
    },
  };
}
