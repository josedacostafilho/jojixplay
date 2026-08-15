---
status: Active
last_verified: 2026-08-15
scope: Repeatable one-player pose stability and latency measurement protocol
---

# Pose quality and latency measurement

## Purpose

This protocol turns subjective shaking into comparable one-player evidence without collecting video or pose coordinates. [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md) owns the signal architecture and model-selection rationale. This document owns how contributors measure the current implementation and evaluate a replacement.

## Current measurement surface

While phone tracking is active, expand **Pose diagnostics** below the camera preview. The panel reports a rolling two-second window:

| Metric | Meaning | Interpretation |
| --- | --- | --- |
| Camera callbacks | Frames presented by the browser per second | Camera/browser delivery ceiling |
| Orientation normalization | Screen type/angle, source dimensions, applied quarter-turn, canonical layout/dimensions, and epoch | Evidence that the phone and MediaPipe share one upright basis |
| Inference submissions | Frames accepted by the single-flight estimator per second | Work offered after busy-frame dropping |
| Inference completions | Pose packets completed per second | Achieved model cadence |
| Processing age, median / p95 | Completion time minus the camera callback timestamp | Bitmap, worker, and MediaPipe delay on the phone |
| Coarse-hand p95 spread | 95th-percentile radial distance from the rolling median hand center | Motion plus estimation noise; it represents jitter only while the hand is intentionally still |
| Worst coarse landmark | Largest wrist/pinky/index/thumb p95 spread | Identifies whether one constituent dominates the hand center |

All values are local, aggregate, bounded, and ephemeral. They are not telemetry and are not sent to the television.

## Baseline procedure

Run each measurement with exactly one player selected.

1. Record the phone model, operating system, browser and version, canonical layout/dimensions, screen type/angle, source dimensions, applied rotation, epoch, lighting, and approximate person-to-camera distance.
2. Mount the phone in its intended position. Keep the full body visible and make each hand large and unobstructed enough for all four coarse landmarks.
3. Start tracking and allow at least 30 seconds of warm-up.
4. Record camera, submission, completion, and processing-age values over a sustained 60-second run. Note temperature, visible throttling, and battery impact.
5. Hold the left hand still for at least five seconds and record its coarse-hand and worst-landmark spread after the two-second window is fully stationary. Repeat three times.
6. Repeat for the right hand.
7. Enter Draw and record perceived cursor delay, immediate close-hand activation, wide-hand release, false activation/release, grip continuity, and visible Pencil/Eraser path quality while making slow curves and fast direction changes.
8. Observe the phone and television avatars at rest, during slow movement, during fast direction changes, after a brief landmark dropout, and after leaving/re-entering frame. Record visible rest shimmer, overshoot, fast-motion lag, limb-length distortion, missing-part behavior, and recovery.
9. Repeat a shorter run in portrait, landscape-primary, and landscape-secondary. Confirm the phone video/avatar agree, the television mirror remains horizontally intuitive, achieved cadence and processing age remain acceptable, and each committed transition increments the epoch without a temporal bridge.
10. Keep the exact camera position, lighting, distance, warm-up, and motions for every model comparison.

Do not interpret a rolling spread captured during movement as model jitter. Do not report a requested 30 FPS ceiling as achieved inference cadence.

## Model replacement experiment

The committed production model remains Lite until evidence supports a replacement. To evaluate Full:

1. Create an isolated experiment branch.
2. Replace the vendored Lite asset, checksum, Vite copy destination, camera-controller asset URL, asset-verification script, tests, and all model-name documentation in one hard cutover. Do not add a selector or retain the Lite asset in that branch.
3. Run `npm run validate` and deploy the experiment artifact separately from validated `main`.
4. Repeat the complete baseline procedure on the same target phone.
5. Prefer Full only if stationary coarse-hand spread improves materially while achieved cadence, processing-age p95, drawing responsiveness, sustained thermals, startup, and asset size remain acceptable.
6. Record the evidence and accept one model. Merge a single-model hard cutover or delete the experiment branch; never merge both runtime paths.

No universal numeric budget is selected before the first target-device baseline. A model name or offline benchmark alone is not acceptance evidence.

## Avatar-presentation acceptance

The procedural avatar now owns one isolated presentation filter per canvas under [ADR-0014](../decisions/0014-procedural-body-avatar.md). It adaptively smooths continuous one-pose display copies with a `22–72 ms` time constant, applies bounded limb-length stabilization, and uses near-side depth hysteresis. It resets on missing input, frame-layout/epoch/sequence/time discontinuity, or zero/multiple poses; multi-pose presentation has no temporal association. Exact behavior lives in [Avatar renderer](../product/avatar-renderer.md).

Evaluate that display path separately from raw interaction:

- compare a stationary avatar with the phone's coarse-hand spread, but do not treat the avatar as a diagnostic measurement source;
- compare slow motion and fast reversals for a meaningful reduction in shimmer without objectionable lag, overshoot, or rubber-limb behavior;
- verify that landmark loss omits affected anatomy instead of holding stale geometry and that reappearance starts from the current observation;
- verify that one-to-two, two-to-one, pose loss, frame-layout/epoch changes, and re-entry do not carry one person's display history onto another; and
- repeat the Draw, Bubbles, and Racing checks to confirm that avatar smoothness cannot change grip, paths, buttons, hand rings, collisions, scores, wheel calibration, steering, or pause gestures; Racing must remain avatar-free.

Do not add an alternate filter, style selector, raw-render fallback, or different game-specific avatar. Replacing a constant or algorithm requires recorded target-device evidence, one updated canonical contract, proportional regression tests, and a hard cutover. The unsmoothed canonical `PosePacket` remains unchanged under every presentation outcome. Orientation acceptance is governed by [Camera orientation](../product/camera-orientation.md).
