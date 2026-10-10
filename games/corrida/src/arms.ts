import * as THREE from "three";
import type { Direction } from "./puppet";
import { FIGURE, torsoTip } from "./world";

/**
 * How the player holds themselves at one instant. This is all the game ever says to the arms, so
 * different-looking ones can take these ones' place without the game changing.
 */
export interface ArmsPose {
  /** Each arm's two segments as directions in the character's space; null lets that arm hang. */
  arms: {
    left: { upper: Direction; lower: Direction | null } | null;
    right: { upper: Direction; lower: Direction | null } | null;
  };
  /** Torso lean in radians, positive towards the screen's right. */
  lean: number;
  /** Torso lean forward in radians. */
  pitch: number;
  /** 0 standing, 1 fully crouched. */
  crouch: number;
  /** Which gloves are flashing: their arm has just thrown a punch. */
  punching: { left: boolean; right: boolean };
}

const {
  hip: HIP,
  torso: TORSO,
  shoulder: SHOULDER,
  upperArm: UPPER_ARM,
  forearm: FOREARM,
  limb: LIMB,
  crouchDrop: CROUCH_DROP,
  hand: HAND,
  armRest: ARM_REST,
} = FIGURE;

/** A limb hangs straight down from its pivot until it is turned. */
const DOWN = new THREE.Vector3(0, -1, 0);
/** Depth is the least steady thing the camera tells, so it is followed a little more slowly. */
const DEPTH_SHARE = 0.6;
const GLOVE = "#ffd23f";
/** A glove flashes this colour when its arm throws a punch. */
const GLOVE_PUNCHING = "#ff2d2d";

/** The character faces down the road, which is the scene's negative z. */
function inScene(direction: Direction, into: THREE.Vector3): THREE.Vector3 {
  return into.set(direction.x, direction.y, -direction.z);
}

function ease(current: number, target: number, share: number): number {
  // Angles take the short way round.
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * share;
}

/**
 * The player's own arms, seen through the character's eyes: rounded sleeves, forearms and bright
 * gloves, hung from shoulders that move as the unseen torso does. They belong to no theme, so the
 * world around them can change while they stay the same.
 */
export function createArms() {
  const skin = new THREE.MeshStandardMaterial({ color: "#fff4e0", roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#ff8a3d", roughness: 0.7 });
  const materials: THREE.Material[] = [skin, shirt];
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

  const root = new THREE.Group();
  const hips = new THREE.Group();
  // The torso is not drawn. It turns about the hips and carries the shoulders with it.
  const torso = new THREE.Group();
  root.add(hips);
  hips.add(torso);
  const handGeometry = new THREE.SphereGeometry(HAND, 20, 14);
  geometries.push(handGeometry);

  function arm(side: -1 | 1) {
    const upper = limb(UPPER_ARM, LIMB, shirt);
    upper.position.set(side * SHOULDER, TORSO, 0);
    const lower = limb(FOREARM, LIMB * 0.9, skin);
    lower.position.y = -UPPER_ARM;
    // Each glove has its own colour: it is what says a punch has been thrown.
    const glove = new THREE.MeshStandardMaterial({ color: GLOVE, roughness: 0.6 });
    materials.push(glove);
    const hand = new THREE.Mesh(handGeometry, glove);
    hand.position.y = -FOREARM;
    lower.add(hand);
    upper.add(lower);
    torso.add(upper);
    const rest = new THREE.Vector3(Math.sin(side * ARM_REST), -Math.cos(ARM_REST), 0);
    return { upper, lower, glove, rest, upperWay: rest.clone(), lowerWay: rest.clone() };
  }
  // Facing the way the character faces, its left is the screen's left.
  const arms = { left: arm(-1), right: arm(1) };
  let lean = 0;
  let pitch = 0;
  let crouch = 0;
  const wanted = new THREE.Vector3();
  const upperTurn = new THREE.Quaternion();
  const lowerTurn = new THREE.Quaternion();
  const undo = new THREE.Quaternion();
  /** Moves a limb's direction part of the way to where it should point. */
  function follow(way: THREE.Vector3, target: THREE.Vector3, share: number) {
    way.x += (target.x - way.x) * share;
    way.y += (target.y - way.y) * share;
    way.z += (target.z - way.z) * share * DEPTH_SHARE;
    // Passing through the shoulder on the way to the opposite direction leaves no direction.
    if (way.lengthSq() < 1e-4) way.copy(target);
    way.normalize();
  }

  return {
    object: root,
    /** Moves towards a pose; `share` is how much of the remaining way to go this frame. */
    pose(target: ArmsPose, share: number) {
      lean = ease(lean, target.lean, share);
      pitch += (target.pitch - pitch) * share * DEPTH_SHARE;
      crouch += (target.crouch - crouch) * share;
      torso.rotation.z = -lean;
      // Crouching tips the torso a little forward; standing, it tips as the player leans.
      torso.rotation.x = -torsoTip(crouch, pitch);
      hips.position.y = HIP - crouch * CROUCH_DROP;

      for (const side of ["left", "right"] as const) {
        const part = arms[side];
        const seen = target.arms[side];
        follow(part.upperWay, seen ? inScene(seen.upper, wanted) : part.rest, share);
        // A forearm the camera lost carries on straight from the upper arm.
        follow(
          part.lowerWay,
          seen?.lower ? inScene(seen.lower, wanted) : seen ? part.upperWay : part.rest,
          share,
        );
        // Arms are given in the character's space; the torso's own turn is already in its
        // children, and the upper arm's in the forearm.
        upperTurn.setFromUnitVectors(DOWN, part.upperWay);
        lowerTurn.setFromUnitVectors(DOWN, part.lowerWay);
        part.upper.quaternion.copy(undo.copy(torso.quaternion).invert()).multiply(upperTurn);
        part.lower.quaternion.copy(undo.copy(upperTurn).invert()).multiply(lowerTurn);
        // At once, not eased: the colour is the game saying what it has just read.
        part.glove.color.set(target.punching[side] ? GLOVE_PUNCHING : GLOVE);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
