---
status: Active
last_verified: 2026-09-24
scope: Current capabilities, verification, and remaining acceptance
---

# Project status

## Snapshot

JojixPlay is a greenfield static landscape phone application with Draw, Bubbles, Racing, a procedural avatar, and native procedural sound. All camera inference and rendering run on the phone. External operating-system or wired mirroring is the only television experience. Complete real-device acceptance remains outstanding.

## Implemented

- Root-only entry with a portrait rotate screen and landscape-only setup/play.
- Trusted camera/audio startup; optional fullscreen, native landscape lock, and wake lock; explicit Stop and portrait/unmount teardown.
- Hidden camera capture, one MediaPipe worker, landscape canonical packets, frame epochs, and direct in-memory delivery with one-second freshness.
- One-player default with direct apply-before-display two-player selection.
- Compact left-column body controls, isolated procedural avatar presentation, Draw, Bubbles, and lazy forced-Canvas analog torso Racing.
- Removal of TV/paired-phone pages, pairing credentials, QR, Trystero/WebRTC, mode routing, layout commands, and portrait game/control geometry.

## Verification

On 2026-09-24, `npm run validate` passed under Node 24.19.0/npm 11.17.0: formatting, warning-free lint, 124 unit/component tests, model integrity, production builds, four Chromium journeys, and the high-severity audit gate. The audit reports two moderate advisories in the existing Vitest tooling. Vite retains the known large lazy Racing chunk advisory. These checks do not establish real-device acceptance.

## Immediate work and risks

- Validate both landscape directions, browser camera metadata, native orientation lock and rejected-lock portrait teardown on target phones.
- Measure combined camera/inference/render/audio performance, thermals, battery use, and external-mirroring latency and quality.
- Exercise every one-/two-player game, sound activation and suspension, control reach, no-preview framing, Stop, and resource release on real hardware.
- Racing remains a large lazy chunk; startup and sustained Canvas performance require device evidence.

GitHub Actions validates changes and deploys validated `main` to `https://josedacostafilho.github.io/jojixplay/`. This working-tree cutover is not a publication claim. [Stack](../architecture/stack.md) owns versions and commands; [Backlog](backlog.md) owns remaining work.
