import * as THREE from "three";
import type { Direction } from "./puppet";

/**
 * How the character should stand at one instant. This is all the game ever says to a character,
 * so a different-looking one can take this one's place without the game changing.
 */
export interface CharacterPose {
  /** Each arm's two segments as screen directions; null lets that arm hang. */
  arms: {
    left: { upper: Direction; lower: Direction | null } | null;
    right: { upper: Direction; lower: Direction | null } | null;
  };
  /** Torso lean in radians, positive towards the screen's right. */
  lean: number;
  /** 0 standing, 1 fully crouched. */
  crouch: number;
  /** Where the legs are in their running cycle, in radians; null stands still. */
  stride: number | null;
}

// Proportions of the one character, in world units. It is about 1.7 tall whoever plays.
const HIP = 0.86;
const THIGH = 0.42;
const SHIN = 0.4;
const TORSO = 0.52;
const SHOULDER = 0.21;
// Arms are a quarter longer than a real body's, so a pose reads from across a room.
const UPPER_ARM = 0.34;
const FOREARM = 0.32;
const LIMB = 0.075;

/** The angle that turns a limb hanging straight down to point along a screen direction. */
function swing(direction: Direction): number {
  return Math.atan2(direction.x, -direction.y);
}

function ease(current: number, target: number, share: number): number {
  // Angles take the short way round.
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * share;
}

/**
 * A rounded toy figure seen from behind: ball head, capsule body and limbs. It belongs to no
 * theme, so the world around it can change while it stays the same.
 */
export function createCharacter() {
  const skin = new THREE.MeshStandardMaterial({ color: "#fff4e0", roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#ff8a3d", roughness: 0.7 });
  const shorts = new THREE.MeshStandardMaterial({ color: "#25226b", roughness: 0.8 });
  // Poses are read from the hands, so they stand out from the body and the road.
  const glove = new THREE.MeshStandardMaterial({ color: "#ffd23f", roughness: 0.6 });
  const materials = [skin, shirt, shorts, glove];
  const geometries: THREE.BufferGeometry[] = [];

  /** A capsule hanging from its pivot, so turning the pivot swings it like a limb. */
  function limb(length: number, radius: number, material: THREE.Material) {
    const geometry = new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 12);
    geometries.push(geometry);
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    return pivot;
  }
  function ball(radius: number, material: THREE.Material) {
    const geometry = new THREE.SphereGeometry(radius, 20, 14);
    geometries.push(geometry);
    return new THREE.Mesh(geometry, material);
  }

  const root = new THREE.Group();
  const hips = new THREE.Group();
  root.add(hips);
  const pelvis = ball(0.17, shorts);
  pelvis.scale.set(1.15, 0.8, 0.9);
  hips.add(pelvis);

  // The torso turns about the hips, carrying shoulders, arms and head with it.
  const torso = new THREE.Group();
  hips.add(torso);
  const chestGeometry = new THREE.CapsuleGeometry(0.17, TORSO - 0.2, 6, 16);
  geometries.push(chestGeometry);
  const chest = new THREE.Mesh(chestGeometry, shirt);
  chest.position.y = TORSO / 2 + 0.04;
  chest.scale.set(1.2, 1, 0.85);
  torso.add(chest);
  const head = ball(0.155, skin);
  head.position.y = TORSO + 0.24;
  torso.add(head);

  function arm(side: -1 | 1) {
    const upper = limb(UPPER_ARM, LIMB, shirt);
    upper.position.set(side * SHOULDER, TORSO, 0);
    const lower = limb(FOREARM, LIMB * 0.9, skin);
    lower.position.y = -UPPER_ARM;
    const hand = ball(LIMB * 1.55, glove);
    hand.position.y = -FOREARM;
    lower.add(hand);
    upper.add(lower);
    torso.add(upper);
    return { upper, lower, rest: side * 0.14, upperAngle: side * 0.14, lowerAngle: side * 0.14 };
  }
  function leg(side: -1 | 1) {
    const thigh = limb(THIGH, LIMB * 1.15, shorts);
    thigh.position.set(side * 0.1, 0, 0);
    const shin = limb(SHIN, LIMB, skin);
    shin.position.y = -THIGH;
    const foot = ball(LIMB * 1.2, shorts);
    foot.position.set(0, -SHIN, -0.05);
    foot.scale.set(1, 0.7, 1.7);
    shin.add(foot);
    thigh.add(shin);
    hips.add(thigh);
    return { thigh, shin };
  }
  // Seen from behind, the character's left is the screen's left.
  const arms = { left: arm(-1), right: arm(1) };
  const legs = { left: leg(-1), right: leg(1) };
  let lean = 0;
  let crouch = 0;

  return {
    object: root,
    /** Moves towards a pose; `share` is how much of the remaining way to go this frame. */
    pose(target: CharacterPose, share: number) {
      lean = ease(lean, target.lean, share);
      crouch += (target.crouch - crouch) * share;
      torso.rotation.z = -lean;
      // Crouching folds the legs and tips the torso a little forward.
      torso.rotation.x = -crouch * 0.35;
      hips.position.y =
        HIP -
        crouch * 0.3 +
        (target.stride === null ? 0 : Math.abs(Math.sin(target.stride)) * 0.035);

      for (const side of ["left", "right"] as const) {
        const part = arms[side];
        const seen = target.arms[side];
        const upper = seen ? swing(seen.upper) : part.rest;
        // A forearm the camera lost carries on straight from the upper arm.
        const lower = seen?.lower ? swing(seen.lower) : upper;
        part.upperAngle = ease(part.upperAngle, upper, share);
        part.lowerAngle = ease(part.lowerAngle, lower, share);
        // The torso's own lean is already in its children; arms are given as screen directions.
        part.upper.rotation.z = part.upperAngle + lean;
        part.lower.rotation.z = part.lowerAngle - part.upperAngle;

        const phase =
          target.stride === null ? null : target.stride + (side === "left" ? 0 : Math.PI);
        const stride = phase === null ? 0 : Math.sin(phase) * 0.7 * (1 - crouch * 0.4);
        const lift = phase === null ? 0 : Math.max(0, Math.cos(phase)) * 0.9;
        legs[side].thigh.rotation.x = stride + crouch * 1.05;
        legs[side].shin.rotation.x = -(0.15 + lift + crouch * 1.5);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
