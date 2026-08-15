---
status: Active
last_verified: 2026-08-15
scope: Procedural body-avatar appearance, presentation-only pose stabilization, and implementation plan
---

# Procedural body avatar

## Intended outcome

The phone and television present each detected person as a polished, faceless 2D digital mannequin instead of a landmark-and-line skeleton. The avatar is synthesized entirely from the existing 33 normalized pose landmarks: it is a readable body representation, not an inferred silhouette or an anatomically exact reconstruction.

This is a presentation-only change. Unsmoothed canonical [`PosePacket`](skeleton-viewer.md#pose-packet-contract) values remain the sole input to controls and games. The avatar may make its own display copy smoother, but it must never feed projected or stabilized values back into pairing, pose controls, Draw, Bubbles, Racing, or transport. Racing deliberately mounts no avatar and uses car/steering feedback instead.

## Visual contract

Each drawable pose uses:

- a soft oval head and short neck;
- a curved shoulder-to-hip torso;
- tapered upper and lower arms and legs with rounded joints;
- a coarse mitten hand only when all four established coarse-hand landmarks are usable;
- a rounded foot only when ankle, heel, and foot-index landmarks are usable; and
- a neon material with a dark body fill, colored gradient, subtle rim, and restrained highlight.

Pose zero uses teal and pose one uses rose. Those colors remain the shared visual accents for the corresponding body-control pointer and game input affordances; palette position is not player identity.

The renderer draws far-side limbs first, then the central neck/torso/head layers, then near-side limbs. Landmark `z` is used only for this local presentation ordering. The renderer does not expose dots, bone lines, a legacy skeleton mode, an asset fallback, or a runtime style switch.

If the shoulders or hips needed to form a torso are unavailable, that pose is not drawn. Individual limbs, hands, feet, and the head are omitted when their own required landmarks are unavailable; missing geometry is never fabricated from stale observations.

## Projection and appearance profiles

Avatar projection uses the same contained canonical-camera transform and mirroring rule as controls, games, and hit testing. The packet and anatomical left/right landmark indices are never swapped. Phone-owned orientation normalization precedes this renderer; an active game withholds a packet from the avatar while its layout is mismatched.

| Surface | Mirrored | Avatar opacity | Purpose |
| --- | --- | ---: | --- |
| Television menus | Yes | `0.94` | Primary live body representation |
| Draw | Yes | `0.24` | Spatial feedback without obscuring artwork |
| Bubbles | Yes | `0.16` | Spatial feedback without hiding targets and effects |
| Racing | — | Not rendered | Car plus wheel/tracking gauge replace the live body view |
| Phone camera preview | No | `0.38` | Lightweight local tracking confirmation |

Opacity is applied once to the complete avatar layer. Rendering is event-driven on a new packet, resize, or appearance change; it does not introduce an independent permanent animation loop.

## Presentation solver

The television and phone avatar canvases each own an isolated `AvatarPresentationSession`. Updating a session returns a fresh display frame and never mutates its input packet.

### One visible pose

For one-pose packets, the session applies adaptive exponential smoothing to usable `x`, `y`, and `z` coordinates:

- the smoothing time constant ranges from `72 ms` near rest to `22 ms` during fast movement;
- speed is measured in camera-frame minimum-dimension units so portrait and landscape frames behave consistently;
- smoothing state continues only across an increasing sequence in the same camera frame dimensions, layout, and epoch with no capture-time gap greater than `250 ms`;
- duplicate sequence renders return the cached display frame and do not advance state; and
- an unusable landmark is shown from the current packet and resets only that landmark's temporal state, so no stale limb is held on screen.

After coordinate smoothing, the solver gently stabilizes the visible lengths of arm and leg segments. Its length reference follows with a `420 ms` time constant; each frame applies `55%` of the difference and caps correction to `12%` of the measured segment. Corrections propagate from the shoulder or hip toward the wrist or ankle, including the related hand or foot points. This reduces rubber-limb shimmer without pinning joints or adding a perceptible hold.

The established near side changes only when the opposing side is nearer by at least `0.035` normalized depth, avoiding rapid draw-order flicker around an ambiguous frontal pose.

### Zero or multiple poses

A zero-pose packet clears temporal state. A multi-pose packet renders independent current-packet copies with no cross-frame smoothing, length history, matching, or identity assumption. Its near/far order is derived only from the current packet. Returning to one pose starts a new presentation history.

## Performance and implementation boundaries

- Use Canvas 2D paths and gradients already available in browsers. Add no image, font, model, game-engine, renderer, or animation dependency.
- Allocate bounded work per packet: at most two poses and a fixed number of body primitives.
- Size every stroke and body part from projected body measurements with viewport-relative bounds so degenerate landmarks cannot create extreme geometry.
- Keep the renderer pure: clearing, projection, material selection, primitive synthesis, and drawing happen from one supplied presentation frame and explicit options.
- Keep temporal state in the presentation session, not in the renderer or domain packet.
- Preserve the current accessible canvas roles with labels that describe a live body avatar.

## Implementation plan

- [x] Add and unit-test the isolated one-player presentation solver, including resets, immutability, adaptive response, bounded segment stabilization, near-side hysteresis, and identity-independent multi-pose behavior.
- [x] Add and unit-test the procedural Canvas renderer, including torso gating, partial-landmark omission, layer ordering, gradients, body primitives, opacity, mirroring, and two-pose palette selection.
- [x] Replace `SkeletonCanvas` with `AvatarCanvas` on both phone and television, select the profile from the current television view, and retain the accent palette for existing pointers and game affordances.
- [x] Delete the old stick-skeleton renderer, component, CSS names, imports, labels, and tests in the same hard cutover.
- [x] Update current product, architecture, engineering, project-status, and agent documentation; preserve only genuinely historical uses of “skeleton viewer.”
- [x] Run the formatter, linter, type checker, unit/component suite, production build, and browser suite, then audit for stale runtime paths and accidental compatibility behavior.

## Acceptance criteria

The change is complete when phone and television avatar canvases render only the procedural avatar; menus, Draw, and Bubbles use the specified appearances; Racing renders no avatar; raw input still governs every interaction; one-player display jitter is reduced without a hold timer; multi-pose rendering introduces no identity tracker; missing data fails by omission; old renderer code is deleted; and the complete canonical validation suite passes.

Real-device visual quality, sustained television performance, perceived display latency, and the chosen material proportions remain acceptance risks until tested on the target phone and television.

The canonical coordinate basis, orientation mismatch, and epoch-reset rules are governed by [ADR-0015](../decisions/0015-canonical-camera-orientation.md) and [Camera orientation](camera-orientation.md).
