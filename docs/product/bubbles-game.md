---
status: Active
last_verified: 2026-08-14
scope: User-visible behavior and implemented design for the Bubbles game
---

# Bubbles game

## Outcome

Bubbles is a timed one- or two-player game. Procedurally rendered soap bubbles drift inside the reachable phone-camera projection, and every complete coarse hand can pop them. The television owns simulation, collision, score, animation, and results; the phone continues to send only validated pose landmarks.

## Navigation and round contract

```text
Main Menu
└── Games
    ├── Draw
    ├── Bubbles
    └── Return → Main Menu

Bubbles — Ready
├── Start
└── Exit → Games

Bubbles — Starting / Playing
└── No active buttons

Bubbles — Finished
├── Play Again
└── Exit → Games
```

- Ready requires at least the acknowledged number of usable players: one torso in one-player mode or two torsos in two-player mode.
- Start hides and suspends body controls, shows `3`, `2`, `1`, then begins a full 60-second round with `Go!` feedback.
- Bubbles captures the acknowledged player count on entry, before readiness is evaluated. No player-mode switch exists inside Bubbles, so that count remains fixed through every round until Exit.
- The countdown derives from a monotonic deadline and appears at the lower-right. It displays `1:00` at round start and reaches `0:00` exactly when scoring closes.
- Pose loss never pauses the timer. Leaving Bubbles resets its transient round, score, and simulation state.

## Scores and results

- One-player score appears at the top-right.
- Two-player scores appear at the top-left and top-right and belong to mirrored screen-side slots, not skeleton identities.
- With two usable poses, the current leftmost torso owns the left slot and the rightmost owns the right slot. With one temporarily usable pose, the torso's current screen half selects its slot.
- Players should remain on their screen sides. Crossing sides transfers subsequent attribution to the newly occupied side.
- Every bubble is worth one point regardless of size. A bubble can score once.
- One-player results declare the final score. Two-player results declare Left, Right, or a tie and include both scores.

## Arena and bubble population

- The exact contained mirrored camera projection is the arena. Bubbles never appear in unreachable letterbox or pillarbox space.
- One-player rounds maintain six bubbles; two-player rounds maintain eight.
- Bubble radius varies from `0.03` to `0.07` of the camera frame's minimum dimension.
- Initial and replacement spawn positions remain fully in bounds and make bounded attempts to avoid other bubbles and current hands.
- A popped bubble schedules one replacement after a random 350–700 ms delay while the round remains active.

## Movement and edge behavior

- Bubble target speed varies from `0.025` to `0.055` arena-minimum-dimensions per second. Smaller bubbles may be modestly faster, and easing between directions may briefly move more slowly.
- A bubble selects a gently upward-biased target direction every 0.8–2 seconds and eases toward it, producing smooth air-current drift rather than per-frame random jitter.
- Soft steering begins near the arena edge.
- The complete bubble always remains visible. If its radius crosses a boundary, the center is clamped to the legal radius-aware limit and the relevant velocity component reflects inward with a small random angular variation. A corner reflects both axes.
- Bubble-to-bubble physics is intentionally absent. Initial overlap is discouraged, but translucent bubbles may pass through one another.
- Movement consumes a capped animation delta after a frame stall; round time still consumes the complete monotonic elapsed duration.

## Hand input and collision

- Bubbles consumes the canonical complete wrist/pinky/index/thumb hand center from both hands of every usable current pose.
- Gameplay does not depend on the temporary menu controller lease, a raised-hand gesture, Draw's grip, pose-array order, or a stable identifier.
- Each usable hand has a forgiving `0.025` arena-minimum-dimension hit radius and a visible side-colored ring.
- Collision tests the current hand point plus the segment from its previous fresh sample. This catches a fast hand that crosses a small bubble between pose packets.
- Missing, stale, non-increasing, out-of-frame, or implausibly long (`> 0.35` arena-minimum-dimensions) hand samples break the segment and cannot create a phantom sweep.
- If several hands reach one bubble in the same update, the closest approach wins; exact ties use deterministic screen-side and anatomical-hand ordering.

## Procedural presentation

- The arena uses a dark blue-violet gradient and restrained boundary treatment.
- Each bubble combines a translucent radial fill, thin cyan/pink/violet rim, upper-left white crescent, lower-right reflection, and slowly rotating shimmer.
- On contact, score updates immediately and the bubble becomes non-collidable. For 240 ms its rim expands and fades, six to ten bounded droplets move outward, and a small `+1` rises from the hit.
- The associated score counter pulses. A replacement bubble fades/scales into its scheduled position.
- The live skeleton remains above the arena at reduced opacity; brighter hand rings remain the clearest gameplay input feedback.
- No image, audio, font, or game-engine asset is added.

## Failure and boundary behavior

- Start remains unavailable with insufficient usable players and explains what is missing.
- A temporary missing hand cannot pop; other currently usable hands continue normally.
- A stale packet creates no swept path. The game continues its timer and bubble simulation without pose input.
- A camera-frame aspect change retains normalized bubble positions, clamps every bubble into the new radius-safe bounds, and clears hand histories before accepting new swept collisions.
- A viewport resize reprojects the normalized arena without changing round time, score, or game coordinates.
- Frame stalls cannot move a bubble outside the arena or extend the round.
- The game sends, stores, and persists no scores, bubble state, hand coordinates, identifiers, or pixels.

## Completed implementation plan

- [x] Add a deterministic television-local Bubbles session owning lifecycle, clock, scores, random bubble generation, drift, edge reflection, pop state, and respawn scheduling.
- [x] Add a pure pose-to-game adapter deriving usable torsos, both complete mirrored hand centers, and identity-independent left/right score slots.
- [x] Add aspect-corrected current-point and fresh swept-segment collision with one-winner deterministic attribution.
- [x] Add a procedural Canvas renderer for bubbles, shimmer, bounded pop particles, floating `+1`, and visible hand hit rings.
- [x] Add Bubbles to Games and integrate Ready, control suspension, Starting, Playing, Finished, Play Again, and Exit into the existing shell without coupling Draw and Bubbles renderers.
- [x] Add semantic score/timer/result surfaces, projected arena styling, accessible status updates, and reduced-opacity skeleton presentation.
- [x] Add deterministic domain, input, renderer, and component regression tests.
- [x] Update canonical architecture, product, status, backlog, milestone, testing, and agent documentation and run the full canonical validation suite.

## Acceptance criteria

1. Games exposes Draw, Bubbles, and Return with no hidden or stale action path.
2. Ready shows Start and Exit and prevents a round until the selected number of usable players is visible.
3. Start suspends controls, shows a three-second countdown, then runs exactly 60 seconds without timer drift.
4. Six one-player or eight two-player bubbles remain fully inside the projected camera arena while varying in accepted radius, speed, position, and smooth drift.
5. Both complete hands can pop through point or fresh swept collision; incomplete and stale input creates no phantom segment.
6. A bubble scores once, plays the complete bounded pop effect, and schedules one replacement in the accepted delay range.
7. One-player scoring uses the top-right counter. Two-player screen-side scoring uses both top corners and remains independent of pose-array ordering.
8. The finished state declares the sole score, the left/right winner, or a tie and exposes neutrally re-armed Play Again and Exit actions.
9. Radius-aware clamp-and-reflect keeps the complete bubble visible through edge contact, corners, frame stalls, and aspect changes.
10. No external asset, backend, persistence, stable player identity, game engine, audio path, or packet change is introduced.
11. Automated gates prove deterministic behavior; real-device acceptance measures hit tolerance, side attribution, readability, sustained rendering, and perceived responsiveness.

The architecture is governed by [ADR-0013](../decisions/0013-identity-independent-bubbles-game.md). Shared pose, player-limit, mirroring, and shell constraints remain governed by the earlier decisions in the [ADR index](../decisions/README.md).
