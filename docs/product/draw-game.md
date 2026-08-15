---
status: Active
last_verified: 2026-08-14
scope: User-visible contract and acceptance criteria for the first JojixPlay game
---

# Draw game

## Outcome

Draw is the first playable JojixPlay content. One temporarily claimed controller brings both hands together to activate a selected Pencil or Eraser, then draws with the lease's main hand until deliberately spreading both hands wide. Camera pixels remain on the phone; Draw consumes only the raw validated `PosePacket` landmarks from the phone-to-television prototype, never the avatar's display copy.

## Navigation contract

```text
Main Menu
├── Background
├── Players: 1 / Players: 2
└── Games
    ├── Draw
    ├── Bubbles
    └── Return → Main Menu

Draw
├── Pencil / Eraser
├── Color
├── Clear
└── Exit → Games
```

- Replacing a view replaces every body-control target in one operation. No hidden prior action remains active.
- The controller lease survives navigation, while target hover, dwell, latch, and neutral arming restart for each new view.
- Main Menu and Games show the normal body-avatar stage. Draw changes only the game presentation inside the television playfield.
- Draw state is ephemeral. Artwork, selected tool, and active color survive navigation within the same mounted television session when Draw re-enters under the same camera layout, but not page reload, disconnect, a new session, or deliberate re-entry under the other layout. The grip never survives view exit or an orientation mismatch.
- Draw supports portrait and landscape and captures its layout on entry. It does not hot-reflow an active canvas. A mismatched packet is withheld while the television asks the user to restore the entering layout.

## Draw presentation

- The exact contained camera projection is the white drawable board with a clear dark border.
- Letterbox or pillarbox space outside the projected camera frame remains the selected dark stage theme and rejects marks.
- Existing drawing is opaque. The live mirrored procedural avatar is rendered above it with the `draw` profile at 24% opacity.
- Four compact buttons form one vertical column just inside the projected camera frame's left edge. The column is centered around the leased torso, clamped inside the reachable frame, and frozen for the lease.
- The main-hand cursor shows the selected Pencil color or the Eraser footprint. A highlighted cursor means the two-hand grip is active. The supporting hand has no drawing cursor.

## Drawing data

- A path point is `{ x, y }` in normalized upright canonical phone-camera coordinates.
- Paths are tagged as Pencil or Eraser. Pencil paths retain the color active when each command was created.
- Pencil width and Eraser diameter scale from the projected camera frame's minimum dimension, not the television viewport or CSS pixels.
- Rendering mirrors `x` at presentation time and never changes anatomical landmarks or the network packet.
- Points closer than the accepted sampling distance are not retained. A main-hand gap or dropout, camera-basis epoch change, toolbar crossing, board exit, orientation mismatch, or implausible main-hand jump ends the current path rather than connecting across unknown motion. Supporting-hand loss alone does not interrupt a valid main-hand path.

## Interaction contract

### Controller and main hand

- The existing claim and lease rules select one controlling pose and one main hand.
- Only the main hand supplies Pencil and Eraser coordinates. Changing tool does not change hands.
- Both complete coarse hands and both visible shoulders belong to the same leased pose. A complete hand requires wrist, pinky, index, and thumb landmarks at the canonical visibility threshold.
- Hand and shoulder distances are measured in aspect-corrected camera space, so the gesture scales with camera orientation and person-to-camera distance.

### Two-hand grip

1. Choose Pencil or Eraser through the left toolbar.
2. Bring both complete hands within `0.75 ×` the current visible shoulder span. One qualifying pose sample activates the selected tool immediately; there is no timer or stationary hold.
3. Move the main hand to draw or erase. Capture-timestamp speed-adaptive smoothing reduces low-speed path noise while preserving faster motion response.
4. Ordinary hand separation does not interrupt the grip. It remains active throughout the gap between the engagement and release thresholds.
5. Spread both complete hands to at least `1.25 ×` the current shoulder span to release. This exaggerated shoulder-width-or-greater gesture is intentionally much wider than the engagement pose.

No mark is produced before engagement. Re-engagement or any path-breaking boundary begins a new path without a bridge segment. Supporting-hand loss alone cannot prove wide separation and therefore does not cancel an active grip or interrupt main-hand drawing; stale overall pose input still fails closed.

## Tool actions

| Action | Result | Button dwell |
| --- | --- | --- |
| Pencil / Eraser | Toggle the selected tool and break the current path without cancelling a valid grip | 900 ms |
| Color | Cycle near-black → blue → red → green → near-black and break the current path | 900 ms |
| Clear | Remove all Pencil and Eraser paths and break the current path | 1,500 ms |
| Exit | Cancel the grip and return to Games without deleting artwork | 900 ms |

Semantic click, remote, and keyboard activation produce the same result as body dwell.

## Failure and boundary behavior

- With no live pose, Draw retains artwork but accepts no marks.
- When the controller lease releases, the grip and current path end while Draw returns to claim guidance without exiting the game.
- A brief missing main hand, board exit, toolbar entry, or implausible jump hides or moves the cursor and breaks the path without cancelling an otherwise valid grip.
- Input stale for more than 250 ms, a viewport/controller reset, a camera-basis epoch change, orientation mismatch, leaving Draw, or session cleanup cancels the grip.
- A viewport resize releases the controller under the existing contract; normalized artwork is reprojected and retained.
- Returning to the captured layout retains the existing art/tool/color but begins from fresh gesture, cursor, controller, and path history. Re-entering Draw from a menu in the other layout clears the old normalized canvas before accepting input.
- Physical camera movement cannot be detected or compensated reliably from pose-only data. The phone is expected to remain stationary.
- Draw never sends artwork, tool state, or pixels to the phone or a remote service.

## Acceptance criteria

1. Main Menu exposes Background, Players, and Games; Games exposes Draw, Bubbles, and Return.
2. Draw atomically exposes Pencil/Eraser, Color, Clear, and Exit in a smaller vertical column inside the projected frame's left edge.
3. Draw shows a white board exactly matching the projected camera frame and dark non-drawable letterbox space.
4. Bringing both complete hands within `0.75 ×` shoulder span immediately activates the selected tool without a timer.
5. The selected main hand draws one continuous smoothed Pencil or Eraser path throughout ordinary movement and the full hysteresis band.
6. Only observed separation at or above `1.25 ×` shoulder span deliberately releases the grip; safety resets remain fail closed.
7. The opposite hand never produces an independent path or cursor, and switching tools retains main-hand ownership.
8. Toolbar entry, bounds exit, main-hand dropout, stale input, camera-basis change, orientation mismatch, and large jumps create no bridge segments; supporting-hand loss alone does not interrupt a latched grip.
9. Tool and Color selections and artwork survive Draw exit/re-entry under the same layout; deliberate re-entry under the other layout clears artwork, while Clear remains a 1,500 ms body action.
10. The procedural avatar remains useful but visually subordinate at 24% opacity, and its display-only stabilization never changes Draw input.
11. Automated gates prove the threshold boundaries, hysteresis, main-hand ownership, one-cursor UI, and vertical layout; real-device acceptance records comfort, continuity, false activation/release, button reach, and perceived latency.

The current Draw interaction is governed by [ADR-0012](../decisions/0012-two-hand-draw-grip.md). The game boundary originates in [ADR-0010](../decisions/0010-menu-and-draw-game.md). Camera cadence is governed by [ADR-0009](../decisions/0009-camera-paced-inference.md), unsmoothed-pose ownership and diagnostics remain governed by [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md) and [Pose quality](../engineering/pose-quality.md), avatar presentation is governed by [ADR-0014](../decisions/0014-procedural-body-avatar.md), and layout behavior is governed by [ADR-0015](../decisions/0015-canonical-camera-orientation.md) and [Camera orientation](camera-orientation.md).
