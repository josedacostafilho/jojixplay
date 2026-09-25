---
status: Active
last_verified: 2026-09-25
---

# Project status

## Implemented

- Phone-only landscape entry and teardown; external screen mirroring only.
- Brazilian Portuguese product UI and movement-operated navigation, help, game entry, confirmations and return after trusted camera setup.
- npm workspace isolation with a renderer-independent named-joint SDK and independent game studios.
- Main game list with Desenhar, Corrida dos Blocos and one unnamed placeholder, over a fullscreen mirrored camera. Simple DOM circles near the estimated index position share exact hit-test projection. The 3D hand renderer, asset and asset lab are removed.
- MediaPipe Full GPU replaces Lite; one worker, one estimate in flight, one local capture, visible behind menus and hidden inside games.
- Independent per-joint availability, capture-age expiry. No whole-body prerequisite.

## Games

Desenhar supports solo and shared two-person painting. It uses isolated rules, bounded instanced Three.js paint, independent colors/widths/hand preference, wrist hover or touch controls, undo and confirmed clear. See [Desenhar](../product/desenhar.md). Corrida dos Blocos is a single-player five-minute first-person run: held-crouch entry, jumping, normalized pose walls, ducking, three lives per level and scored victory. Camera jumps and crouches use bounded animation rather than raw tracking. Tracking loss and dialogs pause the run. See [Corrida](../product/corrida.md). Future games remain the owner's choice.

The owner reports tracking works on the Galaxy S22. This confirms their movement check; new game ergonomics and sustained two-person painting still need phone acceptance.

## Unknown / acceptance risks

The primary target is the owner’s Samsung Galaxy S22, assuming Chrome; current iPhones/Safari are also in scope. Actual cropped-body detection, accuracy, latency, adult/child tracking, sustained thermals and external mirroring must be measured on intended phones. Full GPU is not claimed to solve all model-quality failures. Synthetic fixtures only prove downstream handling. See [tracking acceptance](../engineering/pose-quality.md).

## Publication

GitHub Pages deploys validated `main` pushes to [JojixPlay](https://josedacostafilho.github.io/jojixplay/). The [deployment workflow history](https://github.com/josedacostafilho/jojixplay/actions/workflows/pages.yml) records the published commit and deployment outcome.

## Validation

The canonical `npm run validate` checks workspace boundaries, formatting, lint, unit/component behavior, model checksum, strict types, all three production builds, Chromium real-worker startup/cleanup and the high-severity dependency audit. Full-phone acceptance remains separate. Vite reports the Three.js chunk-size advisory; the audit reports two existing moderate development-tool advisories in Vitest/mocker.
