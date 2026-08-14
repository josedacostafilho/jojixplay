---
status: Active
last_verified: 2026-08-14
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
| Inference submissions | Frames accepted by the single-flight estimator per second | Work offered after busy-frame dropping |
| Inference completions | Pose packets completed per second | Achieved model cadence |
| Processing age, median / p95 | Completion time minus the camera callback timestamp | Bitmap, worker, and MediaPipe delay on the phone |
| Coarse-hand p95 spread | 95th-percentile radial distance from the rolling median hand center | Motion plus estimation noise; it represents jitter only while the hand is intentionally still |
| Worst coarse landmark | Largest wrist/pinky/index/thumb p95 spread | Identifies whether one constituent dominates the hand center |

All values are local, aggregate, bounded, and ephemeral. They are not telemetry and are not sent to the television.

## Baseline procedure

Run each measurement with exactly one player selected.

1. Record the phone model, operating system, browser and version, orientation, reported camera frame size, lighting, and approximate person-to-camera distance.
2. Mount the phone in its intended position. Keep the full body visible and make each hand large and unobstructed enough for all four coarse landmarks.
3. Start tracking and allow at least 30 seconds of warm-up.
4. Record camera, submission, completion, and processing-age values over a sustained 60-second run. Note temperature, visible throttling, and battery impact.
5. Hold the left hand still for at least five seconds and record its coarse-hand and worst-landmark spread after the two-second window is fully stationary. Repeat three times.
6. Repeat for the right hand.
7. Enter Draw and record perceived cursor delay, immediate close-hand activation, wide-hand release, false activation/release, grip continuity, and visible Pencil/Eraser path quality while making slow curves and fast direction changes.
8. Keep the exact camera position, lighting, distance, warm-up, and motions for every model comparison.

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

## Presentation-filter decision gate

Do not infer that a Draw engagement improvement requires smoothing the skeleton. Consider a television presentation filter only when the live skeleton remains objectionably unstable after the selected model and camera setup are measured. Any proposal must state:

- which landmarks are filtered;
- maximum added visual lag and reset behavior;
- whether filtering is television-only;
- how presentation remains separate from controls and games; and
- how one-player real-device motion demonstrates improvement.

The raw `PosePacket` remains unchanged under every outcome.
