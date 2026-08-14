---
status: Active
last_verified: 2026-08-14
scope: Current repository state, risks, and immediate decisions
---

# Project status

## Snapshot

| Field | Current truth |
| --- | --- |
| Lifecycle | Greenfield / deployed current prototype / pre-release |
| Product purpose | Free phone-as-body-controller experiences; current proof is a skeleton viewer plus Draw |
| Application code | Skeleton-viewer vertical slice and first game implemented |
| Runtime architecture | Implemented under ADR-0002 through ADR-0010 |
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
- The phone requests its user-facing camera only after a user action, loads the vendored MediaPipe Lite model in a module worker, and previews locally detected skeletons. Its camera requests an ideal/maximum 30 FPS; eligible callbacks run serial inference without a lower elapsed-time gate, while busy frames are dropped. Each pairing session defaults to one-pose inference.
- The Trystero room authenticates exactly one opposite-role peer and carries latest-only, strictly validated pose packets plus one strict acknowledged player-limit command over WebRTC DataChannels.
- The television ignores malformed and non-increasing packets, clears stale or disconnected output, and renders up to two identity-independent skeletons through a shared mirrored Canvas projection.
- A single person claims a temporary controller with one raised hand; in a multiperson frame, one person must raise both. The complete semantic button row must fit above the controlling head, freezes for the lease, and requires the coarse hand to leave once before deliberate dwell activation arms.
- Main Menu toggles the background, requests acknowledged one-/two-player inference, or opens Games. Games exposes Draw and Return; Draw exposes Color, a longer-dwell Clear, and Exit through atomically replaced, neutral-rearmed body controls.
- Draw owns an ephemeral normalized camera-coordinate artwork model, an exact white projected-camera board, an opaque selected-hand brush, an opposite-hand eraser, deliberate 500 ms tool engagement/lifting, speed-aware smoothing, fail-closed path breaks, and a 28%-opacity live skeleton overlay.
- Unit/component tests and production-browser smoke tests cover the deterministic boundaries, including fake-camera MediaPipe initialization.
- The repository is cut over to Node 24, jsdom 30, immutable GitHub Action SHAs, grouped Dependabot updates, pull-request validation, and least-privilege publication jobs. GitHub reports Dependabot vulnerability alerts and automatic security-update pull requests enabled.
- GitHub Actions validates and publishes the static artifact to the live GitHub Pages project site.

## Immediate work

Validate the complete journey on the project owner's real phone and television, including achieved camera-paced inference cadence, menu transitions, and Draw ergonomics. This is an external acceptance step; it does not justify an alternate implementation in the meantime.

## Pre-release exit criteria

- A real phone and television complete TV-mode/fullscreen entry, QR and manual-key pairing, camera startup, pose delivery, Main Menu/Games/Draw navigation, stale/disconnect behavior, and cleanup.
- Default one-person detection, acknowledged one-/two-player switching, achieved inference cadence, mirrored presentation, overhead framing, coarse-hand stability, temporary controller claiming, transition re-arming, Draw path quality, tool dwell false-positive behavior, thermal behavior, and perceived latency are recorded from the target hardware.

## Verification evidence

On 2026-08-14, `npm run validate` passed under Node 24.19.0/npm 11.17.0 after the camera-paced inference and Draw cutover: exact toolchain verification, formatting, linting, 78 unit/component tests, vendored-model integrity, two production builds, five Chromium end-to-end journeys, and the high-severity dependency audit all passed; npm reported zero vulnerabilities.

## Known risks

| Risk | Impact | Required response |
| --- | --- | --- |
| Smart-TV browser capabilities vary | Fullscreen, pairing, or rendering may fail on the target television | Keep fullscreen best-effort, enforce blocking capability checks for required APIs, and test the owner's hardware |
| Public Nostr relay availability is external | A room may not discover its peer | Surface a terminal pairing error; replace the architecture only through a hard cutover if evidence requires it |
| No TURN service exists | Isolated Wi-Fi clients cannot connect | Treat direct connection failure as unsupported for this prototype |
| Real camera and model behavior is hardware-dependent | Fake media proves initialization, not accuracy, thermals, or sustained latency | Run the documented real-device acceptance pass |
| Camera-paced inference can increase sustained phone load | Power use, heat, and two-player throttling may rise even though work cannot backlog | Record achieved cadence and thermals on target phones before changing the explicit 30 FPS ceiling |
| Above-head pose-control geometry and timing are human factors | Buttons may be tiring to reach, the coarse hand may disappear, or dwell may misfire | Measure the accepted defaults on real people and replace them only from recorded evidence |
| Draw state grows with retained path segments | Very long sessions or resize replays may tax a television browser | Measure long-session behavior and choose an explicit bound only from evidence |
| Runtime player-limit replacement is device-dependent | `setOptions()` may pause or fail on a target phone | Keep acknowledgement fail-closed, terminate an uncertain tracking run, and measure switching on real hardware |
| Future game rendering can attract speculative abstractions | Complexity can precede evidence | Keep the shell independent, but install no game engine until a real game consumes it |
| Compatibility habits can introduce permanent clutter | Multiple paths become de facto contracts | Enforce ADR-0001 and delete displaced paths in the same change |

## Status maintenance

Update this file whenever a snapshot fact, active risk, blocking question, or lifecycle stage changes. Move completed durable events to [Milestones](milestones.md), remove resolved transient items, and keep detailed future work in [Backlog](backlog.md).
