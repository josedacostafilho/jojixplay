---
status: Active
last_verified: 2026-08-14
scope: Bubbles game lifecycle, simulation, input, scoring, presentation, and runtime boundaries
---

# ADR-0013: Add identity-independent Bubbles

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** None
- **Superseded by:** [ADR-0014](0014-procedural-body-avatar.md) for the visible reduced-opacity body layer; [ADR-0015](0015-canonical-camera-orientation.md) for layout policy, frame epochs, and full-state orientation pause/resume. The remaining Bubbles lifecycle, input, simulation, and scoring decisions remain active

## Context

JojixPlay needs a second game that exercises responsive discrete collisions, simultaneous hands, timed rounds, scoring, procedural animation, and the existing one-/two-pose inference modes. Bubbles must remain compatible with static GitHub Pages deployment and the established renderer-independent application shell.

Two-player score ownership is the consequential constraint. MediaPipe pose-array positions are not identities, and the project explicitly forbids turning them into stable players. Bubbles therefore needs fair-enough local attribution without introducing transmitted identifiers, persistent tracking, or an identity compatibility path.

## Decision

### Runtime and lifecycle

- Bubbles is a television-local Canvas 2D game with no backend, persistence, game engine, downloaded visual asset, audio dependency, or change to `PosePacket`.
- The game owns four explicit phases: **Ready**, a three-second **Starting** countdown, a 60-second **Playing** round, and **Finished** results.
- Ready exposes **Start** and **Exit**. Playing hides and suspends all body-control actions. Finished exposes **Play Again** and **Exit**, with neutral re-arming before body dwell can activate either action.
- Start requires one usable torso in one-player mode or two in two-player mode. The acknowledged player limit is frozen for the round. Pose loss during Playing does not pause or extend the monotonic 60-second clock.
- One-player rounds maintain six active bubbles; two-player rounds maintain eight. Every pop is worth one point. A replacement is scheduled 350–700 ms after a pop while Playing remains active.

### Identity-independent scoring and hand input

- Bubbles derives both complete coarse hands and a usable torso center directly from every current pose. It does not require or reuse the menu controller lease for gameplay collisions.
- In one-player mode, all accepted pops increment the sole score displayed at the top right.
- In two-player mode, score slots belong to the mirrored screen sides. With two usable poses, the leftmost torso supplies the left slot and the rightmost supplies the right slot for that packet. With one temporarily usable pose, its current screen half selects the slot.
- Pose-array reordering cannot change slot attribution. Players are expected to remain on their screen sides. If they physically cross, attribution follows the screen slots; the game never claims stable personal identity.
- A complete current hand is always tested as a point. A fresh previous-to-current hand segment is also tested so fast motion cannot tunnel through a bubble between pose packets. Stale, missing, out-of-frame, or non-increasing hand samples never fabricate a swept path.
- Each bubble accepts exactly one winner. Competing collision candidates are ordered by closest approach and then a deterministic side/hand tie-break.

### Simulation and boundaries

- Bubble state uses normalized mirrored camera-arena coordinates. Radius and velocity use the camera frame's minimum dimension so sizes, speeds, collision tolerances, and edge behavior are aspect-corrected.
- Radius is selected from 3–7% of the arena minimum dimension. Target speed is selected from 2.5–5.5% per second, with smaller bubbles allowed to drift slightly faster.
- Each bubble eases toward a slowly changing target velocity, selected every 0.8–2 seconds with a mild upward bias. Near an edge, soft steering points it inward.
- A bubble never leaves the reachable arena. If its outer edge reaches or crosses a boundary, its center is clamped so the complete circle remains visible, the relevant velocity component is reflected inward, and a small bounded random angular variation avoids a repeating path. Corners reflect both components; the random source is injected for deterministic tests.
- Animation-frame elapsed time advances movement with a capped movement delta, while phase and round deadlines use the full monotonic time. A suspended browser therefore cannot teleport bubbles or extend a round.
- Initial and replacement spawns make bounded attempts to avoid existing bubbles and currently usable hands. Failure to find an empty candidate still yields a radius-safe in-bounds position rather than an unbounded search.

### Presentation and effects

- The exact contained phone-camera projection is the reachable Bubbles arena. Informational score and timer overlays use television corners and never become collision targets.
- Procedural Canvas drawing creates translucent radial fills, iridescent rims, highlights, shimmer, and bounded pop particles; no image asset or license obligation is introduced.
- A pop scores immediately, becomes non-collidable, expands and fades for 240 ms, emits a bounded droplet burst and `+1`, then is removed. The corresponding score counter pulses.
- The mirrored live procedural avatar remains visible at 16% opacity. Brighter left/right hand rings expose the actual raw collision inputs.

## Consequences

### Benefits

- Bubbles remains a free static application and validates a second renderer behind the existing game-shell boundary.
- Screen-side scoring supports two simultaneous people without weakening the no-identity invariant.
- Swept hand collision remains responsive at variable pose cadence without predicting or globally smoothing pose data.
- Procedural rendering scales to each television, remains deterministic enough for tests, and carries no external asset risk.
- Radius-aware clamping and reflection make off-screen bubbles impossible by construction.

### Costs and risks

- Two-player score continuity assumes players remain on their sides; crossing intentionally changes slot attribution.
- Full-body coarse hands have less precision than a dedicated hand model, so the initial hit radius and visual hand rings require real-device acceptance.
- Canvas gradients, particles, a live avatar, and animation-frame state updates still need performance testing on the owner's television.
- A player dropout consumes round time rather than pausing, which keeps timing simple and deterministic but can affect a competitive result.

## Alternatives considered

### Track stable player identities

Rejected because pose-array order is unstable and a new identity tracker would violate the accepted identity-independent scope without evidence that the game needs it.

### Download bubble sprites

Rejected because procedural Canvas bubbles can scale, vary, shimmer, and pop without licensing, attribution, resolution, or additional network concerns.

### Wrap or respawn bubbles that leave an edge

Rejected because losing a visible target or teleporting it across the arena is less legible than radius-aware inward reflection. Clamp-and-reflect is the canonical safety rule.

### Decrement the timer on an interval

Rejected because delayed callbacks would make a nominal 60-second round last longer. Remaining time is derived from the monotonic round deadline.

## Verification

- Domain tests must prove readiness, exact phase boundaries, the 60-second deadline, target bubble counts, radius/speed ranges, respawn timing, full-circle containment, reflection, deterministic movement, single-pop scoring, swept collision, stale-path rejection, and one-/two-player results.
- Input tests must prove complete-hand requirements, mirrored screen-side sorting, pose-array reorder independence, one-pose fallback attribution, and out-of-frame rejection.
- Renderer tests must prove bubbles, popping effects, `+1`, and hand rings are drawn without image assets.
- Component tests must prove Games navigation, Start/Exit and Play Again/Exit surfaces, control suspension, countdown, timer, one-/two-player score placement, result messaging, and projected arena geometry.
- The full canonical validation suite and real phone/television acceptance remain required before publication claims.

## Follow-up

- Record real-device hit tolerance, score attribution, sustained frame stability, bubble visibility, and two-player side discipline before changing the accepted defaults.
