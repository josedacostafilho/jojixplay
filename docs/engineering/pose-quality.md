---
status: Active
last_verified: 2026-08-15
scope: Repeatable one-player pose stability and latency measurement protocol
---

# Pose quality and latency measurement

## Purpose

This protocol turns subjective shaking into comparable one-player evidence without collecting video or pose coordinates. [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md) owns the signal architecture and model-selection rationale. This document owns how contributors measure the current implementation and evaluate a replacement.

## Measurement procedure

The removed paired-phone preview and diagnostics panel are not part of the phone-only product. Numeric inference/hand-spread baselines remain unmeasured; do not claim requested camera FPS as achieved inference cadence.

On each target phone, record device/browser, both landscape directions, lighting, camera distance, warm-up, battery/thermal behavior, and external-mirroring method. Use browser performance tooling for frame cadence and sustained workload; never save camera pixels or landmark coordinates. Compare stationary avatar shimmer, slow movement, fast reversals, dropout recovery, Draw grip/path continuity, Bubbles hit behavior, and Racing steering comfort. Repeat identical motion and camera placement across model experiments. A future numeric pose-quality experiment must collect only bounded aggregate measurements and remove its instrumentation after analysis.

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

- compare stationary avatar shimmer with raw interaction stability, but do not treat the avatar as a diagnostic measurement source;
- compare slow motion and fast reversals for a meaningful reduction in shimmer without objectionable lag, overshoot, or rubber-limb behavior;
- verify that landmark loss omits affected anatomy instead of holding stale geometry and that reappearance starts from the current observation;
- verify that one-to-two, two-to-one, pose loss, frame-layout/epoch changes, and re-entry do not carry one person's display history onto another; and
- repeat the Draw, Bubbles, and Racing checks to confirm that avatar smoothness cannot change grip, paths, buttons, hand rings, collisions, scores, torso-neutral calibration, steering, or pause gestures; Racing must remain avatar-free.

Do not add an alternate filter, style selector, raw-render fallback, or different game-specific avatar. Replacing a constant or algorithm requires recorded target-device evidence, one updated canonical contract, proportional regression tests, and a hard cutover. The unsmoothed canonical `PosePacket` remains unchanged under every presentation outcome. Orientation acceptance is governed by [Camera orientation](../product/camera-orientation.md).
