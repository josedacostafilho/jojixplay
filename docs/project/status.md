---
status: Active
last_verified: 2026-10-08
---

# Project status

## Implemented

- Phone-only landscape entry and teardown; external screen mirroring only.
- Brazilian Portuguese product UI and movement-operated navigation, help, game entry, confirmations and return after trusted camera setup.
- npm workspace isolation with a renderer-independent named-joint SDK and independent game studios.
- Main game list with Desenhar and Corrida dos Blocos, over a fullscreen mirrored camera. Simple DOM circles near the estimated index position share exact hit-test projection. The 3D hand renderer, asset and asset lab are removed.
- MediaPipe Full Pose GPU serves menus, Desenhar and Corrida. One worker/task, one estimate in flight and one local capture remain active, visible behind menus and hidden inside games.
- Independent per-joint availability, body capture-age expiry. No whole-body prerequisite.
- Games own every in-game control, including confirmed exit, through a one-method host contract. Pose frames reach games and the menu pointer through a channel and never rerender the interface. See [ADR-0029](../decisions/0029-game-owned-controls-and-frame-channel.md).
- Links carrying extra query or fragment text open normally; the retired pairing-link rejection is removed.

## Games

Desenhar supports solo and shared two-person painting. It uses isolated rules, bounded instanced Three.js paint, independent colors/widths/hand preference, wrist hover or touch controls, undo and confirmed clear. See [Desenhar](../product/desenhar.md). Corrida dos Blocos is a single-player five-minute first-person run: held-crouch entry, ducking in level one, normalized pose walls in level two, jumping in level three, three lives per level and scored victory. Camera gestures are gated by the approaching obstacle; symbolic jumps accept dip-and-rise and use a longer bounded animation. Kenney CC0 voxel textures loaded only on game entry, larger race copy and visible amplified hand controls replace the initial presentation. Tracking loss and dialogs pause the run. See [Corrida](../product/corrida.md). Future games remain the owner's choice.

The owner reports tracking works on the Galaxy S22. Their first Corrida trial exposed difficult jumps, jump/duck ambiguity and poor across-room controls/readability. The revised implementation addresses those reports, but its phone/TV comfort and sustained two-person painting still need acceptance.

## Unknown / acceptance risks

The primary target is the owner’s Samsung Galaxy S22, assuming Chrome; current iPhones/Safari are also in scope. Actual cropped-body detection, accuracy, latency, adult/child tracking, sustained thermals and external mirroring must be measured on intended phones. Full GPU is not claimed to solve all model-quality failures. Synthetic fixtures only prove downstream handling. See [tracking acceptance](../engineering/pose-quality.md).

## Publication

Hosting remains free on GitHub Pages. Game-owned asset files are requested on entry, not by the menu or other games. Corrida ships seven selected PNGs (23,183 bytes) with the original license; no external asset service or paid storage is configured.

GitHub Pages deploys validated `main` pushes to [JojixPlay](https://josedacostafilho.github.io/jojixplay/). The [deployment workflow history](https://github.com/josedacostafilho/jojixplay/actions/workflows/pages.yml) records the published commit and deployment outcome.

## Validation

The canonical `npm run validate` checks workspace boundaries, formatting, lint, unit/component behavior, model checksum, strict types, the app and two studio builds, Chromium real-worker startup/cleanup and the high-severity dependency audit. On 2026-10-08, with Node 24.19.0, it passed end to end: 77 unit/component tests, all nine Chromium journeys, lint without warnings and an audit with no findings. Full-phone acceptance remains separate. Vite reports the Three.js chunk-size advisory.
