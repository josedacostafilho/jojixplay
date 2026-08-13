---
status: Active
last_verified: 2026-08-13
scope: Prioritized project work until a canonical issue tracker exists
---

# Project backlog

This is a compact queue, not a wish list. Keep entries actionable and ordered. Once an issue tracker is adopted, it becomes the source of truth and this file should be replaced with a link or deleted in a hard cutover.

## P0 — release the skeleton-viewer vertical slice

- [ ] Run acceptance on the owner's real phone and television: QR and manual-key pairing, selfie-camera selection and consent, one- and two-person rendering, stale/disconnect states, cleanup, and perceived latency.
- [ ] Inspect the real peer connection and confirm that the application sends pose packets only, never a camera media track or pixel payload.

## P1 — establish measured product budgets

- [ ] Record a performance baseline from target hardware, then define budgets for startup time, sustained inference rate, pose-packet freshness, and renderer frame stability.
- [ ] Run a focused accessibility review on the deployed phone and television flows and record any target-browser limitations.

## Entry format

Add new work using a checkbox and an imperative outcome. Include a link to a decision, specification, or issue when one exists. Remove completed items after recording a genuinely significant result in [Milestones](milestones.md); version control retains routine history.

Avoid vague entries such as “improve quality,” speculative features without approved scope, and TODOs that preserve obsolete implementations.
