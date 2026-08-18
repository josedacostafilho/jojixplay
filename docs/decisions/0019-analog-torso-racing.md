---
status: Accepted
last_verified: 2026-08-18
scope: Analog Racing steering, authored course intensity, and two-player opponent presentation
---

# ADR-0019: Hard-cut Racing to analog torso steering and a denser authored course

- **Status:** Accepted
- **Date:** 2026-08-18
- **Decision owners:** Project owner
- **Supersedes:** [ADR-0017](0017-coarse-torso-lean-racing.md)
- **Superseded by:** None

## Context

The calibrated torso-angle source selected in ADR-0017 works on real hardware, but quantizing that continuous measurement to full-left, center, or full-right prevents graduated correction. The first deterministic course also spreads only a few mild turns across eight long sections, so it neither rewards partial steering nor creates enough driving decisions. Two-player Racing already shares one world model, but overtaking visibility needs to become an explicit, directly tested presentation contract rather than an incidental projection.

The pose model remains noisy enough that raw angle cannot map directly from zero. Adding a gesture timer or a long multi-frame filter would make steering late. Random course generation would make one-player times incomparable and make balance failures harder to reproduce.

## Decision

- Racing continues to derive one mirrored, camera-aspect-corrected shoulder/hip torso angle and calibrate a three-second natural neutral per driver.
- Relative lean at or below `3°` produces exactly zero target steering. Magnitude between `3°` and `15°` maps monotonically through `smoothstep` to partial steering, and `15°` or more saturates at full steering. Sign selects left or right. The superseded directional latch and `8°` entry threshold are deleted.
- The existing Racing-local `80 ms` exponential response remains the only normal temporal steering filter. Missing torso input retains the latest target for at most `150 ms`, then marks tracking unavailable and eases toward center. No timer, universal pose smoothing, or transport mutation is introduced.
- The torso gauge follows the actual filtered `[-1, 1]` steering magnitude continuously so input is never a black box.
- The course remains one fixed, authored, deterministic point-to-point track. It uses more and shorter sections, repeated curvature targets for sustained sweepers, smooth tightening curves, left/right transitions, one readable chicane, short recovery straights, and bounded elevation changes.
- Maximum course curvature is bounded so its full-speed drift demand remains below full steering. Automatic throttle remains viable; the course contains no turn that requires an unavailable brake control.
- In two-player Racing, each chase viewport projects the other car from the same course distance and lateral coordinate. A car ahead, approaching, alongside, overtaking, or just overtaken remains visible whenever it lies inside the forward camera frustum; it disappears only behind the chase camera or beyond draw distance. Cars remain non-colliding.
- Course construction, analog mapping, simulation, and projection remain pure TypeScript. Phaser remains a forced-Canvas lifecycle/drawing adapter only.

## Consequences

### Benefits

- Small, medium, and large deliberate leans produce proportionate corrections while neutral jitter remains inside a hard dead zone.
- Sharper curves can demand stronger physical commitment without making mild curves oscillatory.
- A deterministic authored course remains fair, reproducible, and straightforward to tune and test.
- Split-screen position changes become visually legible in both views without stable identity or a second simulation.

### Costs and risks

- `3°` and `15°` are initial human-factors defaults and require target-device measurement.
- Stronger turns increase the importance of projection readability and steering/curvature balance.
- Non-colliding cars can overlap visually at the exact same distance and lateral position.
- A forward chase camera does not show an opponent that has moved substantially behind; a rear-view indicator is not part of this decision.

## Alternatives considered

### Preserve discrete steering and add intermediate bands

Rejected. Multiple latches would retain arbitrary steps and more state while still failing to use the continuous signal already available.

### Map angle linearly from zero

Rejected. Neutral pose jitter would continuously steer the car. A spatial dead zone plus a smooth magnitude curve absorbs small noise without temporal delay.

### Generate a random course per race

Rejected. It would undermine comparable times, deterministic regression tests, and repeatable balancing. Additional variety should eventually come from multiple authored courses.

## Verification

- Pure tests prove symmetry, exact dead-zone and saturation boundaries, monotonic intermediate output, calibration offsets, response timing, dropout centering, and fixed-step equivalence.
- Track tests prove finite monotonic geometry, more frequent direction changes, bounded maximum curvature, both turn directions, smooth transitions, full-speed controllability, and continuous near-road projection.
- Projection tests prove opponent visibility ahead, alongside, during a pass, on a curve, and just behind the player but ahead of the chase camera, plus disappearance behind the camera and beyond draw distance.
- Component and production-browser tests retain lazy forced-Canvas startup, split view isolation, teardown, and actionable UI behavior.
- Real-device acceptance measures neutral stability, partial-control usefulness, full-lock comfort, turn readability, and overtaking clarity.

## Follow-up

- Complete the target-device acceptance in [Racing](../product/racing-game.md).
- Tune no threshold or curvature again without recording target-device evidence.
