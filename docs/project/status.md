---
status: Active
last_verified: 2026-08-13
scope: Current repository state, risks, and immediate decisions
---

# Project status

## Snapshot

| Field | Current truth |
| --- | --- |
| Lifecycle | Greenfield / implemented first vertical slice / pre-release |
| Product purpose | Free phone-as-body-controller experiences; first proof is a television skeleton viewer |
| Application code | Complete local skeleton-viewer vertical slice |
| Runtime architecture | Implemented under ADR-0002 and ADR-0003 |
| Language and framework | TypeScript and Preact |
| Package/build tooling | npm and Vite |
| Test tooling | Vitest, Testing Library, and Playwright |
| CI/CD | Validation and GitHub Pages workflow configured; not executed remotely |
| Deployment target | Static GitHub Pages project site; local artifact verified |
| Persistence model | None by decision |
| Version control | Git repository initialized on `main`; no remote configured |
| Compatibility commitment | None; backwards compatibility is forbidden by default |

This snapshot describes observed repository state, not a proposed architecture.

## Current capabilities

- The role-selection shell, blocking capability checks, television QR pairing surface, and phone controller are implemented.
- The phone acquires camera video only after a user action, loads the vendored MediaPipe Lite model in a module worker, samples at no more than 15 Hz, and previews locally detected skeletons.
- The Trystero room authenticates exactly one opposite-role peer and carries latest-only, strictly validated pose packets over WebRTC DataChannels.
- The television ignores malformed and non-increasing packets, clears stale or disconnected output, and renders up to two identity-independent skeletons through Canvas 2D.
- Unit/component tests and production-browser smoke tests cover the deterministic boundaries, including fake-camera MediaPipe initialization.
- GitHub Actions, dependency updates, and static GitHub Pages deployment are configured.

## Immediate work

Publish the configured Pages workflow, then validate the complete journey on the project owner's real phone and television. These are external acceptance steps; they do not justify an alternate implementation in the meantime.

## Pre-release exit criteria

- The GitHub Pages workflow deploys a working project-path artifact from `main`.
- A real phone and television complete QR pairing, camera startup, pose delivery, stale/disconnect behavior, and cleanup.
- One- and two-person detection behavior and perceived latency are recorded from the target hardware.

## Verification evidence

On 2026-08-13, `npm run validate` passed from the locked dependency graph: formatting and lint checks were clean, 23 unit/component tests passed, the vendored model checksum and production build succeeded with the versioned MediaPipe assets, four Chromium end-to-end journeys passed, and `npm audit --audit-level=high` reported zero vulnerabilities.

## Known risks

| Risk | Impact | Required response |
| --- | --- | --- |
| Smart-TV browser capabilities vary | Pairing or rendering may fail on the target television | Enforce explicit capability checks and test the owner's hardware |
| Public Nostr relay availability is external | A room may not discover its peer | Surface a terminal pairing error; replace the architecture only through a hard cutover if evidence requires it |
| No TURN service exists | Isolated Wi-Fi clients cannot connect | Treat direct connection failure as unsupported for this prototype |
| Real camera and model behavior is hardware-dependent | Fake media proves initialization, not accuracy, thermals, or sustained latency | Run the documented real-device acceptance pass |
| Pages deployment is not yet published | Project-path behavior is verified only in local builds | Configure the remote Pages source and execute the workflow |
| Future game rendering can attract speculative abstractions | Complexity can precede evidence | Keep the shell independent, but install no game engine until a real game consumes it |
| Compatibility habits can introduce permanent clutter | Multiple paths become de facto contracts | Enforce ADR-0001 and delete displaced paths in the same change |

## Status maintenance

Update this file whenever a snapshot fact, active risk, blocking question, or lifecycle stage changes. Move completed durable events to [Milestones](milestones.md), remove resolved transient items, and keep detailed future work in [Backlog](backlog.md).
