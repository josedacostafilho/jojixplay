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

/** ponytail: coarse fingertip estimate; tune on phones before considering finger tracking. */
export function estimateIndexPoint(body: Body, left: boolean, aspect: number): Joint | undefined {
  const wrist = body[left ? "leftWrist" : "rightWrist"];
  if (!wrist) return undefined;
  const index = body[left ? "leftIndex" : "rightIndex"];
  const elbow = body[left ? "leftElbow" : "rightElbow"];
  let dx = 0;
  let dy = -0.035;
  if (index) {
    dx = (index.x - wrist.x) * 1.1;
    dy = (index.y - wrist.y) * 1.1;
  } else if (elbow) {
    dx = (wrist.x - elbow.x) * 0.22;
    dy = (wrist.y - elbow.y) * 0.22;
  }
  const distance = Math.hypot(dx * aspect, dy);
  const scale = distance > 0.08 ? 0.08 / distance : 1;
  return {
    ...wrist,
    x: Math.max(0, Math.min(1, wrist.x + dx * scale)),
    y: Math.max(0, Math.min(1, wrist.y + dy * scale)),
  };
}
