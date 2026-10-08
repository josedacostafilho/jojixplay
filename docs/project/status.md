---
status: Active
last_verified: 2026-09-27
---

# Project status

## Implemented

- Phone-only landscape entry and teardown; external screen mirroring only.
- Brazilian Portuguese product UI and movement-operated navigation, help, game entry, confirmations and return after trusted camera setup.
- npm workspace isolation with a renderer-independent named-joint SDK and independent game studios.
- Main game list with Desenhar, Corrida dos Blocos and a provisionally named swinging prototype, over a fullscreen mirrored camera. Simple DOM circles near the estimated index position share exact hit-test projection. The 3D hand renderer, asset and asset lab are removed.
- MediaPipe Full Pose GPU serves menus, Desenhar and Corrida; Hand Landmarker GPU serves swinging. One worker/task, one estimate in flight and one local capture remain active, visible behind menus and hidden inside games.
- Independent per-joint availability, body capture-age expiry. No whole-body prerequisite.
- A host-mounted swinging prototype with dedicated two-hand tracking, stable open-hand entry, index-fingertip crosshairs, custom 3D finger curl, fist-to-fire/hold and open-to-release. Tracked finger segments and virtual arms are prototype visuals, shown from the player’s side with a bounded edge projection. Detected hands are retained when fingertips extend beyond the camera image. Exact building rays replace automatic targeting; jumping and crouch entry are removed. Dedicated gameplay hand input follows each delivered result, removes omitted hands immediately, retains close wrists, and clears a stalled result stream after one second from receipt. Detected hand ownership and rendering are independent of gesture recognition; unknown curl, gesture resets, replay and help cannot hide available observations. Teias menu circles and host hand exit controls use the same bounded index-fingertip projection as game hands and crosshairs, without wrist amplification. Active swinging runs hide all buttons and navigation cursors; preparation and death screens retain movement-operated help, replay and exit. Model switching keeps one GPU task active and retains the camera stream. Player-count changes and tracking resets renew the bounded first-frame GPU warm-up allowance. Coordinate normalization strips vendor-only fields at every source rotation; detected-hand packets are regression-tested through the receiving validator.

## Games

Desenhar supports solo and shared two-person painting. It uses isolated rules, bounded instanced Three.js paint, independent colors/widths/hand preference, wrist hover or touch controls, undo and confirmed clear. See [Desenhar](../product/desenhar.md). Corrida dos Blocos is a single-player five-minute first-person run: held-crouch entry, ducking in level one, normalized pose walls in level two, jumping in level three, three lives per level and scored victory. Camera gestures are gated by the approaching obstacle; symbolic jumps accept dip-and-rise and use a longer bounded animation. Kenney CC0 voxel textures loaded only on game entry, larger race copy and visible amplified hand controls replace the initial presentation. Tracking loss and dialogs pause the run. See [Corrida](../product/corrida.md). Future games remain the owner's choice.

The owner reports tracking works on the Galaxy S22. Their first Corrida trial exposed difficult jumps, jump/duck ambiguity and poor across-room controls/readability. The revised implementation addresses those reports, but its phone/TV comfort and sustained two-person painting still need acceptance. The [swinging game](../product/swinging-game-plan.md) now has manual hand controls and an independent aim/fire studio. Across-room finger tracking, new control comfort, repeated city cornering and final city art remain unverified or unimplemented.

## Unknown / acceptance risks

The primary target is the owner’s Samsung Galaxy S22, assuming Chrome; current iPhones/Safari are also in scope. Actual cropped-body detection, accuracy, latency, adult/child tracking, sustained thermals and external mirroring must be measured on intended phones. Full GPU is not claimed to solve all model-quality failures. Synthetic fixtures only prove downstream handling. See [tracking acceptance](../engineering/pose-quality.md).

## Publication

Hosting remains free on GitHub Pages. Game-owned asset files are requested on entry, not by the menu or other games. Corrida ships seven selected PNGs (23,183 bytes) with the original license; no external asset service or paid storage is configured.

GitHub Pages deploys validated `main` pushes to [JojixPlay](https://josedacostafilho.github.io/jojixplay/). The [deployment workflow history](https://github.com/josedacostafilho/jojixplay/actions/workflows/pages.yml) records the published commit and deployment outcome.

## Validation

The canonical `npm run validate` checks workspace boundaries, formatting, lint, unit/component behavior, model checksum, strict types, the app and three studio builds, Chromium real-worker startup/cleanup and the high-severity dependency audit. Swinging tests cover rotated curl, stable open-hand entry, manual rays, fixed independent anchors, misses, stale input, model switching and collision handling; Chromium checks its standalone studio and host movement-only help/exit. Full-phone acceptance remains separate. Vite reports the Three.js chunk-size advisory; the audit reports two existing moderate development-tool advisories in Vitest/mocker.
