---
status: Active
last_verified: 2026-08-14
scope: Current repository state, risks, and immediate decisions
---

# Project status

## Snapshot

| Field | Current truth |
| --- | --- |
| Lifecycle | Greenfield / deployed first vertical slice / pre-release |
| Product purpose | Free phone-as-body-controller experiences; first proof is a television skeleton viewer |
| Application code | Complete skeleton-viewer vertical slice |
| Runtime architecture | Implemented under ADR-0002 through ADR-0006 |
| Language and framework | TypeScript and Preact |
| Package/build tooling | Node 24.19.0, npm 11.17.0, and Vite |
| Test tooling | Vitest, Testing Library, and Playwright |
| CI/CD | Full validation on pull requests and `main`; only validated `main` artifacts deploy to GitHub Pages |
| Deployment target | Live static site at `https://josedacostafilho.github.io/jojixplay/` |
| Persistence model | None by decision |
| Version control | Public GitHub repository on `main` with `origin` configured |
| Compatibility commitment | None; backwards compatibility is forbidden by default |

This snapshot describes observed repository state, not a proposed architecture.

## Current capabilities

- The role-selection shell, blocking capability checks, trusted TV-mode/fullscreen entry, television QR/manual-key pairing surface, and phone controller are implemented.
- A fresh 100-bit pairing key feeds the same domain-separated room/password derivation whether scanned or typed; the former room/secret fragment is rejected.
- The phone requests its user-facing camera only after a user action, loads the vendored MediaPipe Lite model in a module worker, samples at no more than 15 Hz, and previews locally detected skeletons. Each pairing session defaults to one-pose inference.
- The Trystero room authenticates exactly one opposite-role peer and carries latest-only, strictly validated pose packets plus one strict acknowledged player-limit command over WebRTC DataChannels.
- The television ignores malformed and non-increasing packets, clears stale or disconnected output, and renders up to two identity-independent skeletons through a shared mirrored Canvas projection.
- A single person claims a temporary controller with one raised hand; in a multiperson frame, one person must raise both. The complete semantic button row must fit above the controlling head, freezes for the lease, and requires the coarse hand to leave once before deliberate dwell activation arms.
- The three prototype actions toggle the background, request acknowledged one-/two-player inference, or replace a three-second 12-circle effect. Skeletons and circles use one fixed two-color palette.
- Unit/component tests and production-browser smoke tests cover the deterministic boundaries, including fake-camera MediaPipe initialization.
- The repository is cut over to Node 24, jsdom 30, immutable GitHub Action SHAs, grouped Dependabot updates, pull-request validation, and least-privilege publication jobs. GitHub reports Dependabot vulnerability alerts and automatic security-update pull requests enabled.
- GitHub Actions validates and publishes the static artifact to the live GitHub Pages project site.

## Immediate work

Validate the complete journey on the project owner's real phone and television, including the above-head coarse-hand control cutover. This is an external acceptance step; it does not justify an alternate implementation in the meantime.

## Pre-release exit criteria

- A real phone and television complete TV-mode/fullscreen entry, QR and manual-key pairing, camera startup, pose delivery, stale/disconnect behavior, and cleanup.
- Default one-person detection, acknowledged one-/two-player switching, mirrored presentation, overhead framing, coarse-hand stability, temporary controller claiming, neutral arming, adaptive reach, dwell false-positive behavior, and perceived latency are recorded from the target hardware.

## Verification evidence

On 2026-08-14, `npm run validate` passed under Node 24.19.0/npm 11.17.0 after the above-head coarse-hand control cutover: exact toolchain verification, formatting, linting, 66 unit/component tests, vendored-model integrity, two production builds, five Chromium end-to-end journeys, and the high-severity dependency audit all passed; npm reported zero vulnerabilities. Remote pull-request validation and the resulting `main` Pages deployment are verified separately during publication.

## Known risks

| Risk | Impact | Required response |
| --- | --- | --- |
| Smart-TV browser capabilities vary | Fullscreen, pairing, or rendering may fail on the target television | Keep fullscreen best-effort, enforce blocking capability checks for required APIs, and test the owner's hardware |
| Public Nostr relay availability is external | A room may not discover its peer | Surface a terminal pairing error; replace the architecture only through a hard cutover if evidence requires it |
| No TURN service exists | Isolated Wi-Fi clients cannot connect | Treat direct connection failure as unsupported for this prototype |
| Real camera and model behavior is hardware-dependent | Fake media proves initialization, not accuracy, thermals, or sustained latency | Run the documented real-device acceptance pass |
| Above-head pose-control geometry and timing are human factors | Buttons may be tiring to reach, the coarse hand may disappear, or dwell may misfire | Measure the accepted defaults on real people and replace them only from recorded evidence |
| Runtime player-limit replacement is device-dependent | `setOptions()` may pause or fail on a target phone | Keep acknowledgement fail-closed, terminate an uncertain tracking run, and measure switching on real hardware |
| Future game rendering can attract speculative abstractions | Complexity can precede evidence | Keep the shell independent, but install no game engine until a real game consumes it |
| Compatibility habits can introduce permanent clutter | Multiple paths become de facto contracts | Enforce ADR-0001 and delete displaced paths in the same change |

## Status maintenance

Update this file whenever a snapshot fact, active risk, blocking question, or lifecycle stage changes. Move completed durable events to [Milestones](milestones.md), remove resolved transient items, and keep detailed future work in [Backlog](backlog.md).
