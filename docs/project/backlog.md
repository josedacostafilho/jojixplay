---
status: Active
last_verified: 2026-08-14
scope: Prioritized project work until a canonical issue tracker exists
---

# Project backlog

This is a compact queue, not a wish list. Keep entries actionable and ordered. Once an issue tracker is adopted, it becomes the source of truth and this file should be replaced with a link or deleted in a hard cutover.

## P0 — release the current prototype

- [ ] Run acceptance on the owner's real phone and television: trusted fullscreen entry, QR and manual-key pairing, selfie-camera selection and consent, achieved inference cadence, acknowledged switching without camera restart, mirrored rendering, overhead framing guidance, Main Menu/Games/Draw navigation, neutral re-arming, close-hand grip activation, wide-hand release, false activation/release, compact left-toolbar reach, Pencil/Eraser continuity, camera-bump behavior, long-session drawing, thermal behavior, stale/disconnect states, cleanup, and perceived latency. Record the one-player Lite baseline through [Pose quality](../engineering/pose-quality.md); two-player stability is not part of the current pose-quality decision.
- [ ] Inspect the real peer connection and confirm that the application sends pose packets only, never a camera media track or pixel payload.

## P1 — establish measured product budgets

- [ ] Record a performance baseline from target hardware, including the local pose diagnostics, then define budgets for startup time, sustained inference rate, processing-age p95, stationary hand spread, pose-packet freshness, and renderer frame stability.
- [ ] Run a focused accessibility review on the deployed phone and television flows and record any target-browser limitations.

## Entry format

Add new work using a checkbox and an imperative outcome. Include a link to a decision, specification, or issue when one exists. Remove completed items after recording a genuinely significant result in [Milestones](milestones.md); version control retains routine history.

Avoid vague entries such as “improve quality,” speculative features without approved scope, and TODOs that preserve obsolete implementations.
