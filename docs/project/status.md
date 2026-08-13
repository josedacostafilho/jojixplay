---
status: Active
last_verified: 2026-08-13
scope: Current repository state, risks, and immediate decisions
---

# Project status

## Snapshot

| Field | Current truth |
| --- | --- |
| Lifecycle | Greenfield / deployed first vertical slice / pre-release |
| Product purpose | Free phone-as-body-controller experiences; first proof is a television skeleton viewer |
| Application code | Complete local skeleton-viewer vertical slice |
| Runtime architecture | Implemented under ADR-0002, ADR-0003, and ADR-0005 |
| Language and framework | TypeScript and Preact |
| Package/build tooling | npm and Vite |
| Test tooling | Vitest, Testing Library, and Playwright |
| CI/CD | Validation and GitHub Pages deployment pass on pushes to `main` |
| Deployment target | Live static site at `https://josedacostafilho.github.io/jojixplay/` |
| Persistence model | None by decision |
| Version control | Public GitHub repository on `main` with `origin` configured |
| Compatibility commitment | None; backwards compatibility is forbidden by default |

This snapshot describes observed repository state, not a proposed architecture.

## Current capabilities

- The role-selection shell, blocking capability checks, trusted TV-mode/fullscreen entry, television QR/manual-key pairing surface, and phone controller are implemented.
- A fresh 100-bit pairing key feeds the same domain-separated room/password derivation whether scanned or typed; the former room/secret fragment is rejected.
- The phone requests its user-facing camera only after a user action, loads the vendored MediaPipe Lite model in a module worker, samples at no more than 15 Hz, and previews locally detected skeletons.
- The Trystero room authenticates exactly one opposite-role peer and carries latest-only, strictly validated pose packets over WebRTC DataChannels.
- The television ignores malformed and non-increasing packets, clears stale or disconnected output, and renders up to two identity-independent skeletons through a shared mirrored Canvas projection.
- A single person claims a temporary controller with one raised hand; in a multiperson frame, one person must raise both. Body-relative semantic buttons freeze for the lease and use deliberate dwell activation.
- The three prototype actions toggle fixed background and skeleton palettes or replace a three-second 12-circle effect without changing the network contract.
- Unit/component tests and production-browser smoke tests cover the deterministic boundaries, including fake-camera MediaPipe initialization.
- GitHub Actions validates and publishes the static artifact to the live GitHub Pages project site.

## Immediate work

Validate the complete journey on the project owner's real phone and television. This is an external acceptance step; it does not justify an alternate implementation in the meantime.

## Pre-release exit criteria

- A real phone and television complete TV-mode/fullscreen entry, QR and manual-key pairing, camera startup, pose delivery, stale/disconnect behavior, and cleanup.
- One- and two-person detection, mirrored presentation, temporary controller claiming, adaptive reach, dwell false-positive behavior, and perceived latency are recorded from the target hardware.

## Verification evidence

On 2026-08-13, `npm run validate` passed from the locked dependency graph after the mirrored pose-control cutover: formatting and lint checks were clean, 39 unit/component tests passed, the vendored model checksum and production build succeeded with the versioned MediaPipe assets, five Chromium end-to-end journeys passed, and `npm audit --audit-level=high` reported zero vulnerabilities. The GitHub Pages workflow independently repeats this suite before deploying `main`.

## Known risks

| Risk | Impact | Required response |
| --- | --- | --- |
| Smart-TV browser capabilities vary | Fullscreen, pairing, or rendering may fail on the target television | Keep fullscreen best-effort, enforce blocking capability checks for required APIs, and test the owner's hardware |
| Public Nostr relay availability is external | A room may not discover its peer | Surface a terminal pairing error; replace the architecture only through a hard cutover if evidence requires it |
| No TURN service exists | Isolated Wi-Fi clients cannot connect | Treat direct connection failure as unsupported for this prototype |
| Real camera and model behavior is hardware-dependent | Fake media proves initialization, not accuracy, thermals, or sustained latency | Run the documented real-device acceptance pass |
| Pose-control geometry and timing are human factors | Buttons may feel difficult to reach or dwell may misfire | Measure the accepted defaults on real people and replace them only from recorded evidence |
| Future game rendering can attract speculative abstractions | Complexity can precede evidence | Keep the shell independent, but install no game engine until a real game consumes it |
| Compatibility habits can introduce permanent clutter | Multiple paths become de facto contracts | Enforce ADR-0001 and delete displaced paths in the same change |

## Status maintenance

Update this file whenever a snapshot fact, active risk, blocking question, or lifecycle stage changes. Move completed durable events to [Milestones](milestones.md), remove resolved transient items, and keep detailed future work in [Backlog](backlog.md).
