---
status: Active
last_verified: 2026-08-14
scope: Prioritized project work until a canonical issue tracker exists
---

# Project backlog

This is a compact queue, not a wish list. Keep entries actionable and ordered. Once an issue tracker is adopted, it becomes the source of truth and this file should be replaced with a link or deleted in a hard cutover.

## P0 — release the current prototype

- [ ] Run acceptance on the owner's real phone and television: trusted fullscreen entry, QR and manual-key pairing, selfie-camera selection and consent, achieved inference cadence, acknowledged switching without camera restart, mirrored avatar rendering, one-player rest stability and fast-motion lag, partial-landmark/re-entry behavior, two-person history-free presentation, overhead framing guidance, Main Menu/Games/Draw/Bubbles navigation, neutral re-arming, Draw close/wide grip ergonomics and Pencil/Eraser continuity, Bubbles Start/Play Again/Exit reach, three-second/60-second timing, either-hand hit tolerance, fast-sweep popping, complete edge containment, score/timer/result readability, two-player screen-side attribution and crossing behavior, camera-bump behavior, long-session drawing, sustained Bubbles rendering, thermal behavior, stale/disconnect states, cleanup, and perceived latency. Record the one-player Lite baseline through [Pose quality](../engineering/pose-quality.md); multi-pose avatar acceptance must not introduce identity tracking.
- [ ] Inspect the real peer connection and confirm that the application sends pose packets only, never a camera media track or pixel payload.

## P1 — establish measured product budgets

- [ ] Record a performance baseline from target hardware, including the local pose diagnostics, then define budgets for startup time, sustained inference rate, processing-age p95, stationary hand spread, pose-packet freshness, avatar rest/fast-motion presentation, Draw replay cost, and combined two-avatar/eight-bubble renderer stability.
- [ ] Run a focused accessibility review on the deployed phone and television flows and record any target-browser limitations.

## Entry format

Add new work using a checkbox and an imperative outcome. Include a link to a decision, specification, or issue when one exists. Remove completed items after recording a genuinely significant result in [Milestones](milestones.md); version control retains routine history.

Avoid vague entries such as “improve quality,” speculative features without approved scope, and TODOs that preserve obsolete implementations.
