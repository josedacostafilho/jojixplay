import * as THREE from "three";
import { type ArmsPose, createArms } from "./arms";
import type { Item, Run } from "./run";
import type { ThemeMaker } from "./themes/theme";
import { FELLING, FIGURE, figure, LANE, MONSTER, stretch, torsoTip, WATER_LEVEL } from "./world";

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
/**
 * When frames average longer than `slowMs`, the picture is eased one step, waiting `settleMs`
 * between steps: drawn at this share of its sharpness, with this share of the scattered scenery.
 */
const EASE = {
  slowMs: 34,
  settleMs: 1000,
  sharpness: [1, 0.8, 0.65, 0.5, 0.4],
  detail: [1, 0.75, 0.5, 0.3, 0.15],
} as const;
/** Where the end of a rope is held: this far above the shoulders' middle and in front of it. */
const ROPE_GRIP = { y: 0.6, z: 0.12 } as const;
/** An arm reaching from its shoulder to the end of the rope, by side. */
const ROPE_ARM = (() => {
  const reach = (side: -1 | 1) => {
    const length = Math.hypot(FIGURE.shoulder, ROPE_GRIP.y, ROPE_GRIP.z);
    const way = {
      x: (-side * FIGURE.shoulder) / length,
      y: ROPE_GRIP.y / length,
      z: ROPE_GRIP.z / length,
    };
    return { upper: way, lower: way };
  };
  return { left: reach(-1), right: reach(1) };
})();
/** How long a glove stays red after its arm throws a punch. */
const PUNCH_FLASH_MS = 250;
/** Stars burst from where a punch lands on a monster: how many, for how long, and how far. */
const BURST = { stars: 14, ms: 550, reach: 3.2 } as const;
/** Water thrown up by falling into a river: how many drops, for how long. */
const SPLASH = { drops: 130, ms: 900 } as const;
/** How far past the character something is still drawn: it is behind the view by then. */
const PASSED_FROM = 1;
/**
 * What the view does of its own accord, each set off by something that happens in the run.
 * Angles are radians, distances world units.
 */
const FX = {
  // The road's pace is never touched, and neither is how far along it the view is: a mistake
  // is told by a hard shake and a drop, not by being held back.
  hit: { ms: 600, up: 0.08, shake: 0.22, drop: 0.14 },
  punch: { ms: 240, lunge: 0.55, narrow: 5, jolt: 0.025 },
  jump: { down: 0.3, landMs: 280, dip: 0.24 },
  pool: { ms: 600, down: 0.5, stride: 1.4, bob: 0.06, sway: 0.03 },
  /** Falling into a ravine: the view pitches down and shudders in the rush of air. */
  plunge: { ms: 160, down: 0.75, shudder: 0.03 },
  /** On a vine the view looks down into the swing and up out of it. */
  arc: { tilt: 0.16 },
  swing: { ms: 380, tilt: 0.06, reach: 0.12 },
  stride: { rate: 0.7, bob: 0.045, sway: 0.008 },
  step: { ms: 380, lean: 0.06 },
  monster: { from: stretch(2.6), turn: 0.13, ms: 260 },
  finish: { from: stretch(0.9), rise: 0.5, up: 0.12 },
  /** A tree coming down just behind: the ground jumps. */
  thud: { ms: 420, drop: 0.16, shake: 0.05 },
} as const;

/**
 * The road seen through the character's eyes. The world slides towards the view, which stays at
 * the same depth and moves only as the player does. Of the character, only the arms are drawn.
 */
export function createScene(container: HTMLElement, makeTheme: ThemeMaker) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const sharpness = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(sharpness);
  renderer.domElement.setAttribute("aria-label", "Pista de Corrida dos Blocos");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 130);
  const theme = makeTheme(scene);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const edge = (3 * LANE) / 2;
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(unitBox);

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
  // A splash, where the character goes into a river: drops thrown up ahead that the run goes
  // through. Each has its own way out and up.
  const drop = new THREE.MeshBasicMaterial({ color: "#cfeaff" });
  materials.push(drop);
  const splash = new THREE.Group();
  const ways = Array.from({ length: SPLASH.drops }, () => {
    const bead = new THREE.Mesh(starGeometry, drop);
    splash.add(bead);
    return {
      bead,
      x: (Math.random() - 0.5) * 9,
      up: 4 + Math.random() * 7,
      ahead: 1 + Math.random() * 11,
      size: 0.15 + Math.random() ** 2 * 0.6,
    };
  });
  splash.visible = false;
  scene.add(splash);
  let splashedAt = Number.NEGATIVE_INFINITY;
  let wasWading = false;
  // The dark that closes in from the edges on a character falling into a ravine.
  const shrouding = { dark: { value: 0 } };
  const shroud = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: shrouding,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: `
        varying vec2 across;
        void main() {
          across = position.xy;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: `
        uniform float dark;
        varying vec2 across;
        void main() {
          float open = mix(1.6, -0.45, dark);
          gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(open, open + 0.45, length(across)));
        }`,
    }),
  );
  geometries.push(shroud.geometry);
  materials.push(shroud.material);
  shroud.frustumCulled = false;
  shroud.renderOrder = 1000;
  shroud.visible = false;
  scene.add(shroud);
  let plunge = 0;
  let previousAt: number | null = null;
  const eyes = new THREE.Vector3(0, EYE_HEIGHT, 0);
  let hang = 0;
  // How far the picture has been eased for a device that cannot keep it smooth, and how long
  // frames have been taking lately.
  let strain = 0;
  let pace = 16;
  let easedAt: number | null = null;
  const hands = new THREE.Vector3();
  let stride = 0;
  let turn = 0;
  let lifted = 0;
  let thudAt = Number.NEGATIVE_INFINITY;
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
    ready: theme.ready,
    render(run: Run, now: number) {
      const elapsed = previousAt === null ? 0 : Math.min(100, now - previousAt);
      previousAt = now;
      // A device that cannot keep the picture smooth is asked for less, a step at a time, and
      // keeps that for the visit: a coarser picture and thinner scenery, the same in kind.
      easedAt ??= now + EASE.settleMs;
      pace += (elapsed - pace) * 0.05;
      if (now > easedAt && pace > EASE.slowMs && strain < EASE.detail.length - 1) {
        strain += 1;
        easedAt = now + EASE.settleMs;
        pace = 16;
        renderer.setPixelRatio(sharpness * (EASE.sharpness[strain] ?? 1));
        resize();
      }
      // Quick enough to feel direct, slow enough to hide the tremor in tracking.
      const share = 1 - Math.exp(-elapsed / 70);
      const running = run.phase === "running";
      const puppet = run.puppet;

      arms.pose(
        puppet
          ? {
              arms: !running
                ? puppet.arms
                : theme.grip === "rope" && run.hanging
                  ? {
                      left: run.grip.left ? ROPE_ARM.left : run.arms.left,
                      right: run.grip.right ? ROPE_ARM.right : run.arms.right,
                    }
                  : run.arms,
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
      // Put back on the road in the dark, the view is there at once.
      if (running && run.dark >= 1) {
        eyes.y = lift + head.y;
        arms.object.position.y = lift;
      }
      shrouding.dark.value = running ? run.dark : 0;
      shroud.visible = shrouding.dark.value > 0.005;
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

      // A hit shakes the view hard and knocks it down for a moment.
      pitch += reel * reel * FX.hit.up;
      roll += Math.sin(reel * Math.PI * 5) * reel * FX.hit.shake;
      rise -= Math.sin(reel * Math.PI) * reel * FX.hit.drop;

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

      // Falling into a ravine it looks down the wall going by, shuddering.
      plunge +=
        ((running && run.falling && run.dark < 1 ? 1 : 0) - plunge) *
        (1 - Math.exp(-elapsed / FX.plunge.ms));
      pitch -= plunge * FX.plunge.down;
      roll += Math.sin(now / 37) * plunge * FX.plunge.shudder;

      // A splash where it goes into a river.
      if (running && run.wading && !wasWading) splashedAt = now;
      wasWading = running && run.wading;
      const thrown = (now - splashedAt) / SPLASH.ms;
      splash.visible = thrown < 1;
      if (splash.visible) {
        const seconds = (now - splashedAt) / 1000;
        for (const { bead, x, up, ahead, size } of ways) {
          // Thrown up from the water ahead; the run carries the view through them.
          bead.position.set(
            eyes.x + x * (0.3 + seconds),
            WATER_LEVEL + up * seconds - 9 * seconds * seconds,
            -ahead + 14 * seconds,
          );
          bead.scale.setScalar(size * (1 - thrown * 0.6));
        }
      }

      // On a vine the view looks down into the swing and up out of it.
      if (running && run.swing !== null)
        pitch -= Math.cos(run.swing * Math.PI) * FX.arc.tilt * hang * calm;

      // Hanging, the body swings a little under the hands.
      pitch += hang * Math.sin(now / FX.swing.ms) * FX.swing.tilt;
      back += hang * Math.sin(now / FX.swing.ms) * FX.swing.reach;

      // On the road the view bobs with each stride.
      const grounded =
        running && !run.hanging && !run.wading && !run.falling && Math.abs(run.lift) < 0.05;
      stride += ((grounded ? 1 : 0) - stride) * (1 - Math.exp(-elapsed / 150));
      rise += Math.abs(Math.sin(run.distance * FX.stride.rate)) * FX.stride.bob * stride;
      roll += Math.sin(run.distance * FX.stride.rate) * FX.stride.sway * stride;

      // A tree that lands just behind shakes the ground under the feet.
      const thud = 1 - since(thudAt, FX.thud.ms);
      rise -= Math.sin(thud * Math.PI) * thud * FX.thud.drop;
      roll += Math.sin(thud * Math.PI * 5) * thud * FX.thud.shake;

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
          made = theme.build(item.obstacle);
          built.set(item, made);
          scene.add(made);
        }
        // A world shows a hollow trunk that was struck bursting apart.
        made.userData.struck = item.struck === true;
        if (
          item.obstacle.kind === "fall" &&
          !made.userData.landed &&
          run.distance - item.obstacle.at >= FELLING.lands
        ) {
          made.userData.landed = true;
          thudAt = now;
        }
        // A monster comes at the character: further off than its place on the road, closing
        // faster, and waddling as it comes.
        const charging = item.obstacle.kind === "monster";
        const behind = (run.distance - item.obstacle.at) * (charging ? MONSTER.charge : 1);
        // Once it has arrived it looms right in front of the view until it strikes or is punched.
        made.position.z =
          charging && (item.state === "coming" || item.state === "punched")
            ? Math.min(behind, -MONSTER_LOOMS)
            : behind;
        // One that has struck is gone in the blow: it is not drawn passing through the view.
        if (charging && item.state === "hit") made.visible = false;
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

      // Both hands meet at the end of a rope, above the middle of the shoulders.
      const holding = running && run.hanging;
      if (holding)
        hands.set(
          arms.object.position.x,
          arms.object.position.y + FIGURE.hip + FIGURE.torso + ROPE_GRIP.y,
          -ROPE_GRIP.z,
        );
      theme.update({
        distance: run.distance,
        now,
        elapsed,
        eyes: camera.position,
        hang,
        detail: EASE.detail[strain] ?? 1,
        running,
        hands: holding ? hands : null,
      });
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      theme.dispose();
      arms.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
