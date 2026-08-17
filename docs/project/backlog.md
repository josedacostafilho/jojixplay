---
status: Active
last_verified: 2026-08-17
scope: Prioritized project work until a canonical issue tracker exists
---

# Project backlog

This is a compact queue, not a wish list. Keep entries actionable and ordered. Once an issue tracker is adopted, it becomes the source of truth and this file should be replaced with a link or deleted in a hard cutover.

## P0 — release the current prototype

- [ ] Run acceptance on the owner's real phone and television: trusted fullscreen entry, QR/manual pairing, selfie-camera consent, portrait and both landscape directions, orientation diagnostics, preview alignment, horizontal mirroring, stable frame epochs, achieved inference cadence, acknowledged player/layout switching, avatar stability, portrait Main Menu reach, compact Games/Draw/Bubbles/Racing reach, unobscured actionable message panels, every game navigation path, two-player Bubbles/Racing landscape gates, active-game rotation recovery, neutral re-arming, Draw grip and Pencil/Eraser continuity, Bubbles timing/hit/containment/score/side behavior, and the complete [Racing acceptance](../product/racing-game.md)—first-load time, one-/two-player sustained Canvas cadence, natural-stance calibration comfort, `8°` lean entry/`3°` release behavior, steering response/dropout, continuous near-road coverage, off-road behavior, overhead pause false positives, split-screen readability, results, page suspension, resize, re-entry, and teardown—plus camera-bump behavior, long-session drawing, thermals, stale/disconnect states, cleanup, and perceived latency. Record the one-player Lite baseline through [Pose quality](../engineering/pose-quality.md); multi-pose behavior must not introduce stable identity.
- [ ] Run [Play on this phone](../product/local-play.md) on the owner's target phone: confirm the hidden capture source never becomes visible, avatar/game framing works without raw preview, direct player/layout changes obey apply-before-display, every game and orientation recovery path matches paired mode, Stop releases camera/wake/fullscreen/game resources, and sustained one-/two-player inference plus Canvas/Phaser rendering has acceptable cadence, heat, battery use, and latency both standalone and through the selected OS or wired screen-mirroring path.
- [ ] Inspect the real peer connection and confirm that the application sends pose packets only, never a camera media track or pixel payload.

## P1 — establish measured product budgets

- [ ] Record paired and all-in-one performance baselines from target hardware in portrait and landscape, including local pose/orientation diagnostics where exposed, then define budgets for application startup, lazy Racing startup, orientation settlement, sustained inference, processing-age p95, stationary hand spread, pose freshness, avatar rest/fast-motion presentation, Draw replay, two-avatar/eight-bubble rendering, one-player Racing, two-player split-screen Racing, combined local inference/rendering, thermals, and external-mirroring latency.
- [ ] Run a focused accessibility review on the deployed phone and television flows and record any target-browser limitations.

## Entry format

Add new work using a checkbox and an imperative outcome. Include a link to a decision, specification, or issue when one exists. Remove completed items after recording a genuinely significant result in [Milestones](milestones.md); version control retains routine history.

Avoid vague entries such as “improve quality,” speculative features without approved scope, and TODOs that preserve obsolete implementations.
