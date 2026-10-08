---
status: Accepted
last_verified: 2026-09-27
---

# ADR-0029: Dedicated hands and manual web aiming

- **Status:** Accepted
- **Date:** 2026-09-27
- **Decision owners:** Product owner
- **Supersedes:** The pose-only inference restriction for swinging; other games retain Full Pose

## Context and decision

The owner replaced raised-arm automatic targeting and jumping with open-hand aiming, fist firing/holding and open-hand release. Swinging uses MediaPipe Hand Landmarker with two hands, never the canned Gesture Recognizer. Game-local finger-joint angles classify curl independently of hand orientation, subject to accurate landmarks. The host retains camera and model ownership. It drains inference, terminates the old worker, loads exactly one GPU task and increments the frame epoch when switching between pose and hands. No models run concurrently and neither is a fallback for the other.

The SDK carries optional dedicated hand observations (21 normalized image points and 21 hand-local meter coordinates), with empty bodies during hand inference. The host validates shape, counts, metadata and coordinates before publication. Handedness confidence is explicitly a classification score, not joint visibility. No bodies or missing joints are fabricated. The game associates nearby wrists across frames; ambiguous overlap clears ownership and disarms firing. No persistent identity exists.

Each hand controls an amplified absolute crosshair in its own screen half. Stable open hands calibrate neutral positions and start play. Closing fires one ray through the displayed crosshair at the first building within range. A miss requires reopening; an attachment stays fixed in world space. Curl onset freezes aim to avoid shot displacement. Missing/stale input releases the affected web; reacquisition requires opening before firing. Jump, crouch entry and automatic targeting are removed. Help and exit work from hand landmarks alone.

## Consequences and verification

Model transitions incur loading/compilation time, and body games keep their existing model. The new hand model adds a vendored asset with checksum verification. Finger detail does not establish across-room reliability or absolute room-space hand position. The arms are virtual; tracked local finger geometry drives prototype hand rendering.

Tests cover rotated curl, ownership, freshness, missed shots, exact rays, model transitions, packet validation and movement-only help/exit. Real-device distance, hand orientation, occlusion, child hand size, latency and thermals remain acceptance work. Tune the current curl thresholds and aim gain on the Galaxy S22 before claiming comfortable play.
