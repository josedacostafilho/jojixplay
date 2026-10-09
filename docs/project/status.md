---
status: Active
last_verified: 2026-10-09
---

# Project status

## Implemented

- Phone-only landscape entry and teardown; external screen mirroring only.
- A touch-only start screen for the adult with three setup steps and one button, in the same indigo-and-yellow look as the menu.
- Brazilian Portuguese product UI and movement-operated navigation, help, game entry, confirmations and return after trusted camera setup.
- npm workspace isolation with a renderer-independent named-joint SDK and independent game studios.
- Body-anchored game menu over the fullscreen mirrored camera: the focused game floats above the player's head and a bubble at each side turns the shelf; hanging arms select nothing. Three synthesized interface sounds. See [ADR-0030](../decisions/0030-body-anchored-menu.md). Not yet tried on a phone: reach distances are untuned.
- MediaPipe Full Pose GPU serves menus, Desenhar and Corrida. One worker/task, one estimate in flight and one local capture remain active, visible behind menus and hidden inside games unless a game asks for the image.
- Sensing is a host service with two kinds, `body` and `hands`. A running game asks for the kind it needs; the host replaces its one worker and model, and the menu gets bodies back when the game ends. Games interpret observations themselves. See [ADR-0031](../decisions/0031-host-sensing-service.md). Body-with-silhouette as its own mode is not built.
- Silhouette sensing from the pose model's own mask on the GPU, drawn in the bench as a tint over the live camera or as a cut-out of the person's own live pixels. On the owner's S22 it takes 60 to 70 ms from capture to arrival. Two other models and a CPU variant were tried and removed. See [ADR-0032](../decisions/0032-silhouette-trial-and-camera-pixels.md).
- **Sensores**, the owner's sensing bench, sits on the menu shelf: the sensed body or both hands drawn over the camera image or a plain background, coloured by the person's own left and right, with reading rate and delay. **Corpo + silhueta** is a disabled placeholder. It is one-person for now and not meant for children. See [Sensores](../product/sensores.md). Not yet tried on a phone.
- Independent per-joint availability, body capture-age expiry. No whole-body prerequisite.
- Games own every in-game control, including confirmed exit, through a one-method host contract. Pose frames reach games and the menu through a channel and never rerender the interface. See [ADR-0029](../decisions/0029-game-owned-controls-and-frame-channel.md).
- Links carrying extra query or fragment text open normally; the retired pairing-link rejection is removed.

## Games

Desenhar supports solo and shared two-person painting. It uses isolated rules, bounded instanced Three.js paint, independent colors/widths/hand preference, wrist hover or touch controls, undo and confirmed clear. See [Desenhar](../product/desenhar.md). Corrida dos Blocos is a single-player five-minute first-person run: held-crouch entry, ducking in level one, normalized pose walls in level two, jumping in level three, three lives per level and scored victory. Camera gestures are gated by the approaching obstacle; symbolic jumps accept dip-and-rise and use a longer bounded animation. Kenney CC0 voxel textures loaded only on game entry, larger race copy and visible amplified hand controls replace the initial presentation. Tracking loss and dialogs pause the run. See [Corrida](../product/corrida.md). Future games remain the owner's choice.

The owner reports tracking works on the Galaxy S22. Hand sensing has not run on a phone: whether hands are found at playing distance, and whether left and right are reported correctly, are unknown. Their first Corrida trial exposed difficult jumps, jump/duck ambiguity and poor across-room controls/readability. The revised implementation addresses those reports, but its phone/TV comfort and sustained two-person painting still need acceptance.

## Unknown / acceptance risks

The primary target is the owner’s Samsung Galaxy S22, assuming Chrome; current iPhones/Safari are also in scope. Actual cropped-body detection, accuracy, latency, adult/child tracking, sustained thermals and external mirroring must be measured on intended phones. Full GPU is not claimed to solve all model-quality failures. Synthetic fixtures only prove downstream handling. See [tracking acceptance](../engineering/pose-quality.md).

## Publication

Hosting remains free on GitHub Pages. Game-owned asset files are requested on entry, not by the menu or other games. Corrida ships seven selected PNGs (23,183 bytes) with the original license; no external asset service or paid storage is configured.

GitHub Pages deploys validated `main` pushes to [JojixPlay](https://josedacostafilho.github.io/jojixplay/). The [deployment workflow history](https://github.com/josedacostafilho/jojixplay/actions/workflows/pages.yml) records the published commit and deployment outcome.

## Validation

The canonical `npm run validate` checks workspace boundaries, formatting, lint, unit/component behavior, model checksum, strict types, the app and three studio builds, Chromium real-worker startup/cleanup with both models and the high-severity dependency audit. On 2026-10-09, with Node 24.19.0, it passed end to end: 114 unit/component tests, all eleven Chromium journeys, lint without warnings and an audit with no findings. Full-phone acceptance remains separate. Vite reports the Three.js chunk-size advisory.
