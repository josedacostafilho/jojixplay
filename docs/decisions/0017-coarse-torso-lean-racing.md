---
status: Active
last_verified: 2026-08-15
scope: Racing steering signal, calibration, hysteresis, dropout, and player feedback
---

# ADR-0017: Hard-cut Racing steering to coarse torso lean

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** Project owner
- **Supersedes:** The two-hand wheel steering and wheel-feedback portions of [ADR-0016](0016-phaser-canvas-racing.md); its runtime, simulation, course, layout, lease, pause, and teardown decisions remain active
- **Superseded by:** None

## Context

The first Racing controller inferred an analog wheel angle from two complete coarse hands. Real-device use showed that this input was not dependable: wrist and finger landmarks jitter, hands occlude one another, and a useful command required continuously maintaining a comparatively precise pose. The game needs a signal that tolerates coarse pose estimation and gives an immediate, legible left/center/right intent without adding a long stabilization delay.

Shoulders and hips are larger, more consistently visible body structures than the four landmarks required for each coarse hand. Their averaged centers also suppress independent landmark noise. They can express the requested physical interaction directly: lean right to steer right and lean left to steer left.

## Decision

- Racing derives one mirrored, aspect-corrected torso angle from the hip-center-to-shoulder-center vector of each usable raw canonical pose. Both shoulders and both hips are required; hands do not participate in steering or readiness.
- Start and Recenter collect three seconds of fresh torso-angle samples per required driver and use their bounded mean as that driver's natural neutral stance. Countdown time advances only while every required torso remains fresh.
- Neutral-relative lean is a discrete three-state command, not an analog magnitude. Crossing `8°` enters full left or full right steering. An entered direction remains latched until lean returns within `3°` of neutral; crossing the opposite `8°` boundary switches direction directly. This Schmitt hysteresis prevents landmark wobble near one threshold from chattering the command.
- The existing Racing-local `80 ms` exponential response remains between the discrete command and car movement. It softens command edges without imposing a gesture hold. A missing torso retains the last command for at most `150 ms`; continued loss marks tracking unavailable, clears the hysteresis state, and eases steering toward center.
- The two-complete-hands-overhead gesture remains the sole in-race pause gesture. Hands otherwise have no Racing control role.
- Calibration and active driving render a restrained torso-lean indicator against an upright reference. The former wheel and hand-dot gauge is deleted.
- Temporary Solo/Left/Right torso leases, `PosePacket`, mirroring, the avatar boundary, fixed-step simulation, Phaser Canvas runtime, and camera-layout policies do not change.

## Consequences

### Benefits

- Steering depends on four central-body landmarks rather than eight hand landmarks and remains available when hands are missing or occluded.
- Drivers make one coarse physical choice—left, centered, or right—while hysteresis absorbs small pose jitter without a timer.
- Neutral calibration accommodates a naturally tilted stance or slightly misaligned camera.
- Existing response and dropout bounds preserve low latency and fail-closed recovery.

### Costs and risks

- Steering is intentionally non-analog; a driver cannot request a partial turn.
- Body translation or camera movement that changes the shoulder-to-hip vector after calibration can affect steering and requires explicit Recenter.
- The `8°`/`3°` thresholds remain target-device human-factors defaults until measured on the owner's phone and television.
- Large body motion or player crossing can still release a temporary two-player lease rather than invent identity.

## Alternatives considered

### Retain the two-hand wheel with more smoothing

Rejected because smoothing cannot restore missing or occluded hand landmarks and would add latency to an already precise gesture.

### Use continuous analog torso angle

Rejected because small torso-estimation changes would continuously modulate steering. The first controller needs coarse intent and stable behavior more than partial-turn precision.

### Add a lean dwell or half-second hold

Rejected because it would make steering visibly late. Spatial hysteresis provides stability without delaying a deliberate threshold crossing.

## Verification

- Input tests prove horizontal mirroring, aspect correction, hand-independent torso extraction, fail-closed torso requirements, temporary leases, epoch resets, and the separate overhead-pause latch.
- Session tests prove fresh-input calibration, the `8°` enter and `3°` release boundaries, direction latching, response filtering, dropout grace, centering, fixed-step determinism, off-road behavior, and results.
- Component and production-browser tests prove current instructions, action lifecycle, lazy runtime behavior, feedback rendering, and cleanup without a wheel compatibility path.
- Real-device acceptance must record threshold comfort, false steering at rest, deliberate turn response, dropout recovery, Recenter behavior, and two-player side stability.
