---
status: Accepted
last_verified: 2026-09-24
scope: Phone execution, external screen mirroring, and landscape entry
---

# ADR-0021: Landscape phone-only play

## Status

Accepted — 2026-09-24.

## Context

Smart-TV browsers are unsuitable for the intended game workload. The user requires all inference, games, and sound to run on the phone, with external screen mirroring as the sole television experience. Portrait play is removed.

## Decision

- Serve one phone application at the root URL. Reject query/fragment routes. Delete mode selection, TV rendering, paired-phone preview, QR/manual credentials, Trystero, WebRTC, and reverse command protocols.
- Require landscape before mounting setup or requesting camera access. Request native landscape locking after the trusted Start action and optional fullscreen entry. Browser policies can reject locking; returning to portrait always unmounts play and releases its resources. The next landscape entry starts a new run.
- Keep one hidden camera, one MediaPipe worker, direct validated in-memory poses, one mirrored body playfield, and one phone-owned audio runtime. Screen mirroring is controlled by the operating system or a cable, outside the app.
- Canonical pose frames are landscape only. Raw source bitmaps may require a quarter-turn; keep that normalization and frame epochs. Delete game layout negotiation, portrait control geometry, and per-game layout policies. Remove the paired-preview appearance and diagnostics panel/monitor, which have no remaining product consumer; future measurement experiments must use bounded aggregates without retaining coordinates.
- Use compact left-column controls everywhere. Every new run starts with one pose; player selection applies directly before display.

## Consequences

No TV browser, network session, or application-managed casting is required. Phones bear the combined inference/render/audio load. Real-device thermal, orientation-lock, camera-coordinate, and external-mirroring acceptance remains required. Camera and sound still require explicit activation.

This decision supersedes ADR-0002, ADR-0004, ADR-0005, ADR-0006, ADR-0008, ADR-0015, and ADR-0018. It replaces the paired/portrait portions of other historical ADRs; their independent game, worker, renderer, and audio decisions remain active. [Phone play](../product/local-play.md) and [Camera orientation](../product/camera-orientation.md) own the current contract.
