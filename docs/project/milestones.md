---
status: Active
last_verified: 2026-08-18
scope: Sparse record of durable completed project milestones
---

# Milestone log

This file records meaningful changes to project capability or governance. It is not a commit log, release changelog, work diary, or substitute for version control. Newest entries go first, and each entry states the resulting durable truth.

## 2026-08-18 — Analog Racing, stronger course, overtakes, and application sound implemented

- Hard-cut Racing's discrete steering latch to a calibrated symmetric analog map with a `3°` dead zone, smooth partial steering through `15°` full scale, the retained `80 ms` response, exact analog gauge feedback, and unchanged `150 ms` dropout grace.
- Replaced the mild eight-section course with one denser deterministic 19-section/`3,444 m` course whose strongest full-speed curve remains below full steering demand, while preserving fixed-step rules and continuous near-road coverage.
- Made two-player opponent projection explicit in both chase views through approach, side-by-side overlap, passing, and just-overtaken depth, with tested curve, camera, and draw-distance boundaries.
- Added one native procedural Web Audio runtime on the TV/local rendering host, trusted startup and partial-failure cleanup, bounded navigation/Draw/Bubbles/Racing cues and voices, background recovery, and a session-local Sound control under the new Settings menu. The paired phone, pure sessions, transport, and Phaser remain audio-free.
- Added direct audio/runtime/component/page, analog mapping, course, and opponent regression coverage. The complete canonical suite passed with 186 unit/component tests and eight production Chromium journeys; real-device steering, course, overtaking, sound, and performance acceptance remains outstanding.

## 2026-08-17 — All-in-one phone play implemented

- Added **Play on this phone** as a first-class third application mode: the shared camera/MediaPipe lifecycle now feeds the shared mirrored body playfield directly in memory with no pairing key, relay, WebSocket, WebRTC, sender queue, backend, or loopback transport.
- Kept the internal capture video visually and accessibility hidden, so local play shows only application status, the procedural avatar, and games; best-effort fullscreen and Screen Wake Lock are owned by trusted start/explicit stop without becoming compatibility requirements.
- Hard-cut query routing from `role` to strict `mode=tv|phone|local`, renamed `TvPlayfield` to `BodyPlayfield`, and updated every implementation, CSS, test, and current reference without retaining aliases.
- Extracted one camera lifecycle for paired and local phone pages, preserved one-pose defaults plus apply-before-display player/layout changes, added a one-second local freshness gate, and kept Draw/Bubbles/Racing as exactly the same renderer and domain paths in both topologies.
- Added direct unit/component and production-browser evidence for routing, capabilities, camera ownership, local packets, no-preview presentation, operation with peer APIs absent, optional immersive cleanup, and first real MediaPipe output. Real-phone combined rendering/thermals and external-mirroring acceptance remain outstanding.

## 2026-08-15 — Racing controls and near-road presentation corrected

- Hard-cut the unreliable two-complete-hand wheel to calibrated, aspect-corrected shoulder/hip torso lean. Racing now uses discrete full left/center/right commands with `8°` entry, `3°` release hysteresis, the existing `80 ms` response, and `150 ms` dropout grace; hands remain only for the overhead pause gesture.
- Replaced the wheel/hand gauge and instructions with natural-stance calibration plus restrained torso-lean feedback, while retaining temporary local driver leases and the raw canonical packet boundary.
- Added an explicit near-road projection sample past the viewport bottom and a below-horizon terrain base, eliminating the blue gap caused when a fixed segment boundary fell behind the near clip.
- Moved Bubbles and Racing Ready/result/pause panels near the top and below the action-control layer so they cannot cover reachable buttons. Added direct hysteresis, hand-independent input, projection-bottom, production-pixel, and compiled-style regressions; target-device ergonomics and performance acceptance remain outstanding.

## 2026-08-15 — Lazy Phaser Canvas Racing implemented

- Added Racing as the third game and the first concrete game-engine consumer: one exact lazy `phaser@4.2.1` runtime forced to Canvas, isolated from the shell, phone, Draw, and Bubbles, with complete exit teardown and no renderer fallback.
- Added pure deterministic track, pseudo-3D projection, `60 Hz` fixed-step car simulation, automatic throttle, curve drift, off-road drag, one-player active-time results, and landscape two-player split-screen winner/tie results.
- Added raw-pose two-hand wheel extraction, three-second valid-input neutral calibration, bounded steering response/dropout handling, ephemeral Solo/Left/Right torso leases, restrained car/wheel tracking feedback, and a latched one-second overhead pause gesture.
- Hard-cut Games to Draw/Bubbles/Racing/Return in one compact left column for both layouts; integrated Racing Ready/Calibrating/Driving/Paused/Finished/error surfaces, layout gates and locks, avatar omission, re-armed actions, and cleanup.
- Added direct input/simulation/projection/catalog/component coverage plus production chunk and browser-runtime checks. Target-phone/television performance, steering ergonomics, pause behavior, split-screen readability, and orientation recovery remain outstanding.

## 2026-08-14 — Canonical portrait and landscape camera layouts implemented

- Hard-cut the orientation-implicit packet and peer protocol to an upright canonical camera frame with strict portrait/landscape metadata and frame epochs; the phone now combines validated Screen Orientation data with actual bitmap dimensions, supplies MediaPipe one clockwise quarter-turn, transforms its unrotated landmark output once, and resets tracking after a stable basis change.
- Added strict acknowledged television-to-phone layout requests, matching phone/TV rotation guidance, canonical phone preview geometry, and bounded local source/rotation/layout/epoch diagnostics without transmitting source orientation.
- Made Main Menu and Games use portrait overhead rows or landscape left columns; Draw and one-player Bubbles accept either layout, while two-player Bubbles is gated on landscape through the shared typed game catalog.
- Locked active games to their entering layout: mismatched pose is withheld, Draw cancels interaction while retaining same-layout art, and Bubbles freezes and resumes its complete clock and simulation with fresh temporal input histories.
- Preserved the delivered camera aspect rather than forcing `4:3` or treating aspect ratio as field-of-view evidence. Added domain, worker, controller, transport, temporal-consumer, game-session, component, and browser-smoke regression coverage; real-device portrait/both-landscape acceptance remains outstanding.

## 2026-08-14 — Procedural body avatar implemented

- Hard-cut the landmark-dot and bone-line renderer to one faceless procedural Canvas body shared by the phone preview and television, with curved torso, tapered rounded limbs, blended joints, complete coarse hands/feet, and teal/rose materials.
- Added isolated immutable display sessions: continuous one-pose presentation uses bounded adaptive coordinate and limb-length stabilization plus depth-order hysteresis, while zero/multiple poses reset history and multi-pose rendering remains current-packet-only and identity-independent.
- Added explicit menu, Draw, Bubbles, and phone appearance profiles without changing `PosePacket`, controls, Draw, Bubbles, transport, dependencies, assets, hosting, or the game-renderer boundary.
- Deleted the former renderer/component/CSS path and added direct solver, renderer, canvas, and playfield regression coverage. Real-device proportions, rest stability, fast-motion lag, partial-landmark behavior, and sustained television rendering acceptance remain outstanding.

## 2026-08-14 — Identity-independent Bubbles implemented

- Added the second game behind the existing renderer-independent shell: Ready/Starting/Playing/Finished phases, a three-second countdown, an exact 60-second round, one-/two-player HUDs, results, Play Again, and Exit.
- Added procedural soap bubbles with size-varied smooth drift, bounded random direction changes, radius-aware clamp-and-reflect edge behavior, one-pop scoring, bounded particle feedback, and delayed replacements entirely inside the projected camera arena.
- Added both-hand current/swept collision independent of the menu controller lease and identity-independent two-player attribution through mirrored Left/Right screen slots.
- Added control suspension and neutral result re-arming plus direct domain, input-adapter, renderer, pose-control, and component regression coverage. Real-device hit tolerance, side discipline, readability, and sustained rendering acceptance remain outstanding.

## 2026-08-14 — Two-hand Draw grip implemented

- Replaced Draw's stationary engagement/lifting classifier with one immediate, body-relative two-hand grip: close hands activate at `0.75 ×` shoulder span and only a deliberate wide spread releases at `1.25 ×`.
- Hard-cut the independent opposite-hand eraser to one main-hand Pencil/Eraser tool selected through the body-controlled toolbar while preserving active-grip continuity across ordinary path breaks.
- Replaced Draw's overhead action row with four smaller buttons in a frozen vertical column at the left edge of the reachable camera projection.
- Added threshold, hysteresis, main-hand ownership, tool, layout, and component regression coverage. Real-device threshold and ergonomics acceptance remain outstanding.

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
