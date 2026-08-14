---
status: Active
last_verified: 2026-08-14
scope: Sparse record of durable completed project milestones
---

# Milestone log

This file records meaningful changes to project capability or governance. It is not a commit log, release changelog, work diary, or substitute for version control. Newest entries go first, and each entry states the resulting durable truth.

## 2026-08-14 — Camera-paced inference and Draw implemented

- Removed the arbitrary 15 Hz sampling gate while retaining a 30 FPS camera ceiling, one inference in flight, busy-frame dropping, and latest-only transport backpressure.
- Replaced the Circles placeholder with typed Main Menu/Games/Draw navigation that retains the temporary controller lease but resets and neutral-rearms each action surface.
- Added a normalized camera-aligned white drawing board, selected-hand brush, opposite-hand eraser, deliberate tool dwell, speed-aware smoothing, path-break safety, color cycling, destructive Clear dwell, and mounted-session-only artwork retention.
- Added direct domain, component, renderer, and cadence regression coverage. Real-device performance and ergonomics acceptance remain outstanding.

## 2026-08-14 — Above-head coarse-hand controls implemented

- Replaced the torso-overlay row with one frozen row wholly above the controlling pose's visible head and an explicit framing gate when the projected camera area lacks headroom.
- Replaced direct wrist pointing with the selected wrist/pinky/index/thumb center while retaining wrist-based claim and release gestures; incomplete hands now pause rather than jump the pointer.
- Added a mandatory post-claim leave-to-arm transition so a raised hand cannot begin dwelling on a button that spawned underneath it.
- Added exact interaction instructions and regression coverage; real-device acceptance remains outstanding.

## 2026-08-13 — Acknowledged player modes and Node 24 cutover implemented

- Made one-player MediaPipe inference the session default and added a strict television-to-phone request/acknowledgement path for switching the existing landmarker between one and two poses.
- Replaced the placeholder skeleton-palette action with the dynamic **Players: 1**/**Players: 2** action, retained one fixed palette, and suspended all actions while reconfiguration is pending.
- Hard-cut the development and CI baseline to Node 24.19.0/npm 11.17.0 and upgraded jsdom and first-party GitHub Actions without retaining Node 22 behavior.
- Added pull-request validation, immutable action references, least-privilege deployment jobs, grouped Dependabot maintenance with vulnerability alerts and security updates enabled, and direct tests for the new domain, transport, worker, concurrency, and accessible UI contracts.

## 2026-08-13 — Mirrored television pose controls implemented

- Added explicit trusted TV-mode entry with a best-effort fullscreen request before session creation.
- Unified skeletons, effects, adaptive controls, cursor, and hit testing under one contained horizontal-mirror projection while preserving raw transport coordinates.
- Added temporary one-hand or multiperson two-hand controller claiming, torso-relative frozen targets, 900 ms dwell activation, deterministic release rules, and semantic remote-operable controls.
- Added the background, complete skeleton-palette, and bounded three-second circle-burst prototype actions without changing the pose packet or transport contract.

## 2026-08-13 — Manual TV pairing implemented

- Replaced QR-only room/secret delivery with one canonical 100-bit pairing-key contract.
- Added a large television key and validated phone entry while retaining the shorter QR path for the same key.
- Added deterministic, domain-separated room/password derivation and removed the superseded fragment shape in a hard cutover.

## 2026-08-13 — First public deployment completed

- Connected the public GitHub repository and published the validated `main` artifact through GitHub Actions.
- Verified the production project site at `https://josedacostafilho.github.io/jojixplay/`.
- Began real-phone acceptance against the deployed artifact; complete phone-to-television acceptance remains outstanding.

## 2026-08-13 — Skeleton-viewer vertical slice implemented locally

- Implemented the static Preact/Vite shell, QR pairing, Trystero/Nostr rendezvous, opposite-role handshake, and direct latest-only WebRTC pose delivery.
- Implemented user-activated camera capture and a MediaPipe Pose Landmarker Lite module worker with a two-person, 15 Hz ceiling.
- Implemented strict fragment and pose-packet validation, ordering and freshness gates, and an identity-independent Canvas 2D renderer.
- Added deterministic dependency locking, Biome and TypeScript gates, unit/component coverage, fake-camera production-browser coverage, dependency auditing, Dependabot, and a GitHub Pages workflow.
- Verified the local production artifact and MediaPipe asset layout; public deployment and real phone/television acceptance remain outstanding.

## 2026-08-13 — Documentation foundation established

- Added the repository-wide agent operating guide.
- Made the greenfield, hardest-cutover, and no-backwards-compatibility posture explicit and non-negotiable.
- Established canonical locations for project status, architecture, stack, engineering standards, testing, workflow, ADRs, and backlog.
- Recorded the initial repository state and established the process used to select the product scope, stack, tests, CI, and deployment architecture.
