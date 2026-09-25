---
status: Accepted
last_verified: 2026-09-24
---

# Fullscreen camera menu and authored hand controls

After trusted camera setup, the phone shows a main game menu over its live camera. Desenhar is the sole playable entry, followed by a one-/two-person choice; unnamed noninteractive “Em breve” cards reserve visual space without choosing future games for the owner. Confirmed game exit returns to the game list.

This replaces hidden-camera and procedural body-view clauses in ADR-0021/0022. The single capture video fills the entire viewport with an aspect-preserving cover crop. Canonical source rotation, horizontal mirroring and crop scale are shared with control projection. The controller publishes committed normalization metadata to the host. No second capture, copied camera canvas, stretched viewport mapping, offset cursor or amplified reach exists. Video and observations stay on-device. Desenhar keeps its own opaque scene; future games choose their presentation independently.

Outside games, only hands are presented. The host uses a fresh wrist and, when both are available, its coarse index/pinky observations to locate the palm. Torso, legs and independently tracked fingers are unnecessary. The same projected point positions the hand mesh and tests buttons. Menus use current hand screen order for ephemeral slots rather than detector body-array identity. Missing/stale input clears the mesh and dwell; discontinuities reset dwell. No extra visual smoothing moves the visible hand away from its hit point.

The authored WebXR Input Profiles generic hand is bundled locally under MIT with its notice, pinned source and SHA-256. Its existing pose is baked into one static mesh; no procedural hand geometry or finger animation is added. The shared renderer and isolated asset lab replace the old diagnostic stick figure and toy renderer. Games retain their own input and rendering choices. All post-setup actions remain movement operable under ADR-0024.
