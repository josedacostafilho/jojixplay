import type { Body, Joint } from "@jojixplay/game-sdk";

/** Exactly the object-fit: cover mapping, shared by the video and its controls. */
export function cameraCover(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const scale = Math.max(viewportWidth / width, viewportHeight / height);
  return {
    width: width * scale,
    height: height * scale,
    left: (viewportWidth - width * scale) / 2,
    top: (viewportHeight - height * scale) / 2,
    scale,
  };
}

export function handCenter(body: Body, left: boolean): Joint | undefined {
  const wrist = body[left ? "leftWrist" : "rightWrist"];
  if (!wrist) return undefined;
  const index = body[left ? "leftIndex" : "rightIndex"];
  const pinky = body[left ? "leftPinky" : "rightPinky"];
  if (!index || !pinky) return wrist;
  return { ...wrist, x: (wrist.x + index.x + pinky.x) / 3, y: (wrist.y + index.y + pinky.y) / 3 };
}
