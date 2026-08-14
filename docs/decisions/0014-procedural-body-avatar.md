---
status: Active
last_verified: 2026-08-14
scope: Live pose presentation renderer and its isolated stabilization boundary
---

# ADR-0014: Replace the stick skeleton with a procedural body avatar

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The visible stick-skeleton presentation portions of ADR-0003, ADR-0005, and ADR-0011
- **Superseded by:** None

## Context

The landmark dots and connection lines proved the end-to-end phone-to-television pipeline, but they are too rough for the product's game-facing visual language. A recognizably articulated body should make pose response and depth ordering easier to read without committing the project to 3D, downloaded art, a segmentation model, or a game engine.

The pose stream is also visibly noisy at rest. Existing consumer separation is critical: menu controls, Draw, and Bubbles deliberately operate from their own current-packet features. Globally smoothing `PosePacket` would increase interaction latency and couple unrelated behavior to a cosmetic choice.

## Decision

- Replace the visible stick skeleton everywhere with one procedural Canvas 2D digital mannequin. This is a hard cutover: no legacy renderer, fallback, feature flag, alias, or debug mode remains.
- Build the avatar from the existing normalized landmarks as a head, neck, curved torso, tapered rounded limb segments, rounded joints, complete coarse hands, and complete feet. Missing required geometry is omitted rather than guessed from history.
- Use bounded body-relative proportions and procedural gradients/rims. Pose slots retain the existing teal and rose accents; pose-array position remains explicitly non-identifying.
- Keep `PosePacket` unchanged and immutable. Mirroring and projection remain presentation concerns, and every control/game continues to consume raw packets or its already accepted local features.
- Give each avatar canvas a private presentation session. One-pose display copies receive adaptive `22–72 ms` exponential landmark smoothing, bounded `420 ms` segment-length reference stabilization, and near-side depth hysteresis. A discontinuity, missing pose, or unusable landmark resets the corresponding history.
- Never associate multi-pose frames across time. Zero- and multi-pose frames reset one-player history; multi-pose avatars use only current-packet geometry and depth order.
- Use explicit appearance profiles: television menu `0.94`, Draw `0.24`, Bubbles `0.16`, and unmirrored phone preview `0.38` opacity.
- Add no downloaded asset, inference output, dependency, backend, persistence, or independent continuous render loop.

The complete geometry, failure behavior, constants, profiles, implementation sequence, and acceptance criteria are canonical in the [avatar renderer specification](../product/avatar-renderer.md).

## Consequences

### Benefits

- The product gains a cohesive body representation while remaining a free static Canvas application.
- Cosmetic stabilization can reduce visible rest jitter without delaying or altering button presses, drawing, or bubble collisions.
- Procedural geometry scales across phone and television viewports and introduces no asset license or loading failure.
- The boundary remains suitable for a future hard cutover to a richer renderer if real game requirements justify it.

### Costs and risks

- A landmark-built mannequin cannot recover true body outline, clothing, occluded volume, or anatomy.
- Procedural proportions and gradients need visual tuning and real-device performance acceptance.
- One-player temporal presentation deliberately differs from raw interaction positions during small noisy movements.
- Multi-person avatars remain noisier because smoothing them without a current identity contract would risk attaching history to the wrong person.

## Alternatives considered

### MediaPipe segmentation silhouette

Rejected for now because it adds a pixel-mask pipeline, heavier phone work and transport or local compositing concerns, and does not create the requested stylized articulated body from the existing pose-only contract.

### Rigged 2D sprite

Rejected because a single authored sprite needs deformation, layering, asset loading, and art-direction decisions while fitting arbitrary proportions less naturally than bounded procedural primitives.

### Three-dimensional avatar

Deferred. It adds model assets, inverse kinematics, a 3D renderer, depth/camera choices, and substantially more low-end television-browser risk before the games require 3D.

### Preserve the skeleton as a fallback

Rejected. The project is greenfield and requires hard cutovers; retaining obsolete visible paths would expand testing and maintenance for no accepted user requirement.

## Verification

- Solver tests prove immutability, discontinuity resets, per-landmark resets, adaptive response, bounded length correction, cached duplicate updates, depth hysteresis, and history-free multi-pose output.
- Renderer tests prove torso gating, partial rendering, body primitives, mirroring, appearance opacity, and palette selection without image assets.
- Component tests prove phone/television profile selection and view transitions while existing control and game regression suites prove input remains raw.
- The complete canonical validation suite and real phone/television acceptance remain required before visual-quality or performance claims.
