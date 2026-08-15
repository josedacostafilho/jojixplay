---
status: Active
last_verified: 2026-08-14
scope: Current repository state, risks, and immediate decisions
---

# Project status

## Snapshot

| Field | Current truth |
| --- | --- |
| Lifecycle | Greenfield / two-game prototype implemented / pre-release |
| Product purpose | Free phone-as-body-controller experiences; current proof is a live procedural body avatar plus Draw and Bubbles |
| Application code | Phone-to-television body-control vertical slice and two games implemented |
| Runtime architecture | Implemented under ADR-0002 through ADR-0015 |
| Language and framework | TypeScript and Preact |
| Package/build tooling | Node 24.19.0, npm 11.17.0, and Vite |
| Test tooling | Vitest, Testing Library, and Playwright |
| CI/CD | Full validation on pull requests and `main`; only validated `main` artifacts deploy to GitHub Pages |
| Deployment target | Validated `main` artifacts publish to `https://josedacostafilho.github.io/jojixplay/` through GitHub Pages |
| Persistence model | None by decision |
| Version control | Public GitHub repository on `main` with `origin` configured |
| Compatibility commitment | None; backwards compatibility is forbidden by default |

This snapshot describes observed repository state, not a proposed architecture.

## Current capabilities

- The role-selection shell, blocking capability checks, trusted TV-mode/fullscreen entry, television QR/manual-key pairing surface, and phone controller are implemented.
- A fresh 100-bit pairing key feeds the same domain-separated room/password derivation whether scanned or typed; the former room/secret fragment is rejected.
- The phone requests its user-facing camera only after a user action, loads the vendored MediaPipe Lite model in a module worker, and previews locally detected procedural body avatars. It accepts portrait or landscape, uses validated Screen Orientation plus actual bitmap dimensions to pass MediaPipe one clockwise quarter-turn, maps unrotated results into an upright canonical frame, and increments a frame epoch after a stable basis change. MediaPipe tracking resets at that boundary without restarting camera capture. The camera still requests an ideal/maximum 30 FPS; eligible callbacks run serial inference without a lower elapsed-time gate, while busy or unsettled-orientation frames are dropped. Each pairing session defaults to one-pose inference.
- A collapsed phone-local diagnostics panel reports current screen/source/rotation/canonical/epoch state plus bounded two-second camera, inference, processing-age, and one-player coarse-hand-spread aggregates at most twice per second. It neither transmits nor persists diagnostics or coordinates.
- The Trystero room authenticates exactly one opposite-role peer and carries latest-only, strictly validated canonical pose packets plus strict acknowledged player-limit and camera-layout commands over WebRTC DataChannels. Protocol `jojixplay-skeleton/3` and the `{ width, height, layout, epoch }` frame are hard-cut contracts.
- The television ignores malformed and non-increasing packets, clears stale or disconnected output, and renders up to two identity-independent faceless body avatars through the shared mirrored Canvas projection. One-pose avatar copies use bounded display-only adaptive landmark/segment stabilization and near-side hysteresis; multi-pose avatars use current-packet geometry with no tracking or history.
- A single person claims a temporary controller with one raised hand; in a multiperson frame, one person must raise both. Main Menu and Games use a frozen semantic row above the controlling head in portrait and a compact left column in landscape; Draw and actionable Bubbles phases use the left column in either layout. Every action surface requires the coarse hand to leave its targets once before deliberate dwell activation arms, and every camera epoch releases temporal control state.
- Main Menu toggles the background, requests acknowledged one-/two-player inference, or opens Games. Games exposes Draw, Bubbles, and Return. Draw exposes Pencil/Eraser, Color, a longer-dwell Clear, and Exit. Bubbles exposes Start/Exit while Ready, suspends all action activation through its countdown and round, then exposes Play Again/Exit through neutrally re-armed controls.
- Draw owns an ephemeral normalized canonical-camera artwork model, an exact white projected-camera board, one selected main-hand Pencil/Eraser cursor, immediate engagement at `≤ 0.75 ×` shoulder span, release at `≥ 1.25 ×` shoulder span, speed-aware path smoothing, fail-closed path breaks, and a 24%-opacity live avatar overlay. It supports either entry layout, cancels grip/path during an active mismatch, retains art while returning to the captured layout, and clears art before deliberate re-entry under the other layout. Controls and Draw continue to use unsmoothed consumer-specific signals rather than the avatar's private display copy.
- Bubbles owns an ephemeral normalized projected-camera arena, six one-player or eight two-player procedurally rendered targets, a three-second countdown, an exact 60-second monotonic round, radius-safe smooth drift/reflection, both-hand point and fresh swept collision, bounded pop/respawn effects, corner HUD counters/timer, a 16%-opacity avatar overlay, and final score/winner/tie results. One-player accepts either layout; two-player is gated on an acknowledged landscape frame. An active mismatch freezes its complete timing/simulation state, while ordinary pose loss does not. Two-player points belong to current mirrored left/right screen slots rather than pose-array positions or stable identities.
- Unit/component tests and production-browser smoke tests cover the deterministic boundaries, including fake-camera MediaPipe initialization.
- The repository is cut over to Node 24, jsdom 30, immutable GitHub Action SHAs, grouped Dependabot updates, pull-request validation, and least-privilege publication jobs. GitHub reports Dependabot vulnerability alerts and automatic security-update pull requests enabled.
- GitHub Actions validates and publishes the static artifact to the live GitHub Pages project site.

## Immediate work

Run the one-player Lite baseline in [Pose quality](../engineering/pose-quality.md), then validate the complete journey on the project owner's real phone and television, including portrait, both landscape directions, reported orientation/source metadata, preview alignment, horizontal TV mirroring, stable epoch transitions, achieved camera-paced inference cadence, avatar rest stability and fast-motion lag, portrait/landscape menu transitions, two-player Bubbles gating, active Draw/Bubbles rotation recovery, Draw close/wide grip ergonomics and path response, Bubbles both-hand hit tolerance and edge containment, score/timer readability, two-player side attribution, sustained renderer cadence, and thermals. This external acceptance step must drive any orientation, threshold, model, collision, or avatar-presentation replacement; it does not justify retaining alternate runtime paths.

## Pre-release exit criteria

- A real phone and television complete TV-mode/fullscreen entry, QR and manual-key pairing, portrait/landscape camera startup, canonical pose delivery, layout requests, Main Menu/Games/Draw/Bubbles navigation, active-game rotation recovery, stale/disconnect behavior, and cleanup.
- Default one-person detection, acknowledged one-/two-player switching, achieved inference cadence, processing-age p95, both landscape rotations, horizontal mirrored avatar presentation, avatar rest stability/fast-motion lag, portrait overhead framing, landscape menu reach, stationary coarse-hand spread, temporary controller claiming, transition re-arming, Draw close/wide grip and path continuity, Bubbles gating/timing/hit tolerance/edge containment/side attribution, renderer stability, thermal behavior, and perceived latency are recorded from the target hardware.

## Verification evidence

On 2026-08-14, `npm run validate` passed under Node 24.19.0/npm 11.17.0 after the canonical-camera-orientation hard cutover: exact toolchain verification, formatting, linting, 134 unit/component tests, vendored-model integrity, two production builds, five Chromium end-to-end journeys, and the high-severity dependency audit all passed; npm reported zero vulnerabilities.

## Known risks

| Risk | Impact | Required response |
| --- | --- | --- |
| Smart-TV browser capabilities vary | Fullscreen, pairing, or rendering may fail on the target television | Keep fullscreen best-effort, enforce blocking capability checks for required APIs, and test the owner's hardware |
| Public Nostr relay availability is external | A room may not discover its peer | Surface a terminal pairing error; replace the architecture only through a hard cutover if evidence requires it |
| No TURN service exists | Isolated Wi-Fi clients cannot connect | Treat direct connection failure as unsupported for this prototype |
| Real camera and model behavior is hardware-dependent | Fake media proves initialization, not accuracy, thermals, or sustained latency | Run the documented real-device acceptance pass |
| Camera-paced inference can increase sustained phone load | Power use, heat, and two-player throttling may rise even though work cannot backlog | Record achieved cadence and thermals on target phones before changing the explicit 30 FPS ceiling |
| Pose accuracy, jitter, and model cost are target-device dependent | A model or filter that looks smoother may reduce cadence or add control latency | Record the one-player Lite baseline with local diagnostics; evaluate Full only through the isolated hard-cutover protocol in [Pose quality](../engineering/pose-quality.md) |
| Draw grip ratios are initial body-relative defaults | Hands may be awkward to bring close enough, release unintentionally, or be difficult to spread far enough | Measure close activation, wide release, and continuity on the target setup before replacing either side of the hysteresis contract |
| Pose-control geometry and timing are human factors | Overhead rows or compact Draw/Bubbles columns may be tiring to reach, the coarse hand may disappear, or button dwell may misfire | Measure the accepted layouts on real people and replace them only from recorded evidence |
| Draw state grows with retained path segments | Very long sessions or resize replays may tax a television browser | Measure long-session behavior and choose an explicit bound only from evidence |
| Bubbles collision defaults are unmeasured on real bodies | Coarse-hand jitter may cause near misses or unintended pops, especially on small bubbles | Measure either-hand point/sweep hits on the target setup before changing radii or sweep freshness |
| Bubbles uses screen sides instead of player identities | Crossing players transfers later points, and a dropout can affect competitive fairness | Keep explicit Left/Right labeling, test two-player behavior, and add no identity tracker without a replacement decision |
| Layered avatar and Bubbles Canvas gradients may tax a weak television | Body feedback or animation may stutter during a round | Measure sustained renderer cadence with two avatars and eight bubbles; simplify the one canonical effect only if evidence requires it |
| Procedural avatar proportions and stabilization are unmeasured on real bodies | The body may look distorted, lag during fast motion, or omit anatomy under occlusion | Record rest, fast-motion, partial-landmark, one-/two-person, phone-preview, Draw, and Bubbles behavior before changing the canonical geometry or constants |
| Runtime player-limit replacement is device-dependent | `setOptions()` may pause or fail on a target phone | Keep acknowledgement fail-closed, terminate an uncertain tracking run, and measure switching on real hardware |
| Mobile orientation metadata and camera bitmap behavior vary | A browser may report a delayed/inconsistent angle or already-rotated bitmap, producing a wrong preview or pose basis | Inspect the bounded phone diagnostics in portrait and both landscape directions; keep the strict single normalization path and hard-cut it only from target-device evidence |
| MediaPipe reset on camera-basis changes is device-dependent | `setOptions()` may pause or fail during rotation | Drop unsettled frames, acknowledge only the committed layout, fail closed on reset failure, and measure transition delay on the target phone |
| Nominal aspect ratio does not prove camera field of view | Forcing `4:3` or `16:9` could crop useful coverage without improving vertical framing | Preserve the delivered aspect ratio and compare camera modes only from device evidence |
| Richer game rendering can attract speculative abstractions | Complexity can precede evidence | Keep each current renderer independent, and install no game engine until an approved game demonstrates the need |
| Compatibility habits can introduce permanent clutter | Multiple paths become de facto contracts | Enforce ADR-0001 and delete displaced paths in the same change |

## Status maintenance

Update this file whenever a snapshot fact, active risk, blocking question, or lifecycle stage changes. Move completed durable events to [Milestones](milestones.md), remove resolved transient items, and keep detailed future work in [Backlog](backlog.md).
