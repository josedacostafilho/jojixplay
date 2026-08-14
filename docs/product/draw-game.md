---
status: Active
last_verified: 2026-08-14
scope: User-visible contract and acceptance criteria for the first JojixPlay game
---

# Draw game

## Outcome

Draw is the first playable JojixPlay content. One temporarily claimed controller uses the selected hand as a brush and the other hand as an eraser on a television-local canvas. Camera pixels remain on the phone; Draw consumes only the same validated `PosePacket` landmarks as the skeleton viewer.

## Navigation contract

```text
Main Menu
├── Background
├── Players: 1 / Players: 2
└── Games
    ├── Draw
    └── Return → Main Menu

Draw
├── Color
├── Clear
└── Exit → Games
```

- Replacing a view replaces every body-control target in one operation. No hidden prior action remains active.
- The controller lease survives navigation, while target hover, dwell, latch, and neutral arming restart for each new view.
- Main Menu and Games show the normal skeleton-viewer stage. Draw changes only the game presentation inside the television playfield.
- Draw state is ephemeral. Artwork and the active color survive navigation within the same mounted television session but not page reload, disconnect, or a new session.

## Draw presentation

- The exact contained camera projection is the white drawable board with a clear dark border.
- Letterbox or pillarbox space outside the projected camera frame remains the selected dark stage theme and rejects marks.
- Existing drawing is opaque. The live mirrored skeleton is rendered above it at 28% opacity.
- Semantic tool buttons remain above the controlling pose's visible head under the canonical headroom rule.
- The brush cursor uses the active ink color. The eraser cursor shows its circular footprint. Both cursors show engagement dwell progress and a distinct active state.

## Drawing data

- A path point is `{ x, y }` in normalized raw phone-camera coordinates.
- Paths are tagged as brush or eraser. Brush paths retain the color active when that path began.
- Brush width and eraser diameter scale from the projected camera frame's minimum dimension, not the television viewport or CSS pixels.
- Rendering mirrors `x` at presentation time and never changes anatomical landmarks or the network packet.
- Points closer than the accepted sampling distance are not retained. A gap, dropout, frame change, or implausible jump ends the current path rather than connecting across unknown motion.

## Interaction contract

### Controller and hands

- The existing claim and lease rules select the controlling pose and brush hand.
- The opposite hand belongs to the same leased pose and operates the eraser.
- A complete hand requires the wrist, pinky, index, and thumb landmarks at the canonical visibility threshold.
- Loss of the selected hand immediately lifts the brush but retains the controller lease for its existing one-second recovery window. Loss of only the opposite hand immediately lifts the eraser without changing controller ownership.

### Tool dwell

1. Place an available hand on the white board while no toolbar button is under it.
2. Hold within the stationary tolerance for 500 ms. The cursor progress ring fills.
3. On completion, that tool engages and any other engaged tool lifts.
4. Move to draw or erase. Speed-aware smoothing reduces low-speed noise while retaining faster movement response.
5. Hold still for 500 ms again to lift, or lift immediately by entering the toolbar, leaving the board, losing the hand, receiving stale input, changing camera dimensions, or jumping beyond the accepted movement bound.

No mark is produced before engagement. Re-engagement begins a new path.

## Tool actions

| Action | Result | Dwell |
| --- | --- | --- |
| Color | Cycle near-black → blue → red → green → near-black | 900 ms |
| Clear | Remove all brush and eraser paths and lift both tools | 1,500 ms |
| Exit | Lift both tools and return to Games without deleting artwork | 900 ms |

Semantic click, remote, and keyboard activation produce the same result as body dwell.

## Failure and boundary behavior

- With no live pose, Draw retains artwork but accepts no marks.
- When the controller lease releases, both tools lift and Draw returns to claim guidance without exiting the game.
- A viewport resize releases the controller under the existing contract; normalized artwork is reprojected and retained.
- A camera frame-dimension change lifts both tools and reprojects retained normalized paths to the new camera bounds.
- Physical camera movement cannot be detected or compensated reliably from pose-only data. The phone is expected to remain stationary.
- Draw never sends artwork, tool state, or pixels to the phone or a remote service.

## Acceptance criteria

1. Main Menu exposes Background, Players, and Games; no Circles action or effect remains.
2. Games exposes Draw and Return, and every menu transition requires neutral re-arming without releasing the controller.
3. Draw shows a white board exactly matching the projected camera frame and dark non-drawable letterbox space.
4. The selected complete coarse hand can dwell-engage an opaque colored brush, move a continuous smoothed path, and dwell-lift it.
5. The opposite complete coarse hand can independently dwell-engage a visible circular eraser; engaging either tool lifts the other.
6. Toolbar entry, bounds exit, dropout, stale input, frame change, and large jumps break paths without bridge segments.
7. Color cycles the fixed palette, Clear requires 1,500 ms body dwell, and Exit/Return navigate as specified.
8. Artwork survives Draw exit/re-entry within the same television session and is never persisted or transmitted.
9. The skeleton remains useful but visually subordinate at 28% opacity.
10. Automated gates pass, while real phone/television acceptance records latency, stability, ergonomics, and thermal behavior separately.

The architectural rationale is governed by [ADR-0010](../decisions/0010-menu-and-draw-game.md). Camera cadence is governed by [ADR-0009](../decisions/0009-camera-paced-inference.md).
