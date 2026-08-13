---
status: Active
last_verified: 2026-08-13
scope: Sparse record of durable completed project milestones
---

# Milestone log

This file records meaningful changes to project capability or governance. It is not a commit log, release changelog, work diary, or substitute for version control. Newest entries go first, and each entry states the resulting durable truth.

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
