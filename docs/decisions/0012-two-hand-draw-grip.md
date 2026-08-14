---
status: Active
last_verified: 2026-08-14
scope: Draw tool engagement, continuity, tool selection, and toolbar placement
---

# ADR-0012: Use a two-hand grip for Draw

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The per-hand stationary engagement/lifting contract in [ADR-0010](0010-menu-and-draw-game.md) and [ADR-0011](0011-consumer-specific-pose-stability.md), plus the opposite-hand eraser and overhead Draw toolbar in ADR-0010
- **Superseded by:** None

## Context

Real-device testing showed that even an outlier-tolerant 500 ms stationary hold interrupts drawing too often. Drawing should begin deliberately but immediately, remain continuous through normal movement and moderate pose-estimation variation, and stop through an unmistakable body gesture. The second hand should participate in that gesture rather than operate a separate eraser.

The previous overhead horizontal toolbar also occupied the central drawing area. Draw now needs four actions—tool mode, color, clear, and exit—without allowing the toolbar to dominate the board.

## Decision

### Body-relative grip

- The controlling lease still chooses one main hand. Only that main hand supplies pencil or eraser points; pose-array position and the opposite hand never become drawing identities.
- Draw derives aspect-corrected hand separation and visible shoulder span from the same leased pose and camera frame.
- When inactive, one fresh sample with both complete hands separated by at most `0.75 × shoulder span` activates the selected tool immediately. There is no engagement timer, stationary test, or progress state.
- Once active, the grip remains active throughout the hysteresis band. It releases only when both complete hands are observed at least `1.25 × shoulder span` apart, or when a safety boundary makes the current interaction invalid.
- The wide `0.75`/`1.25` hysteresis intentionally accepts a book-holding pose to start and requires an exaggerated shoulder-width-or-greater spread to stop. It must not be replaced by one threshold.
- Supporting-hand landmark loss alone cannot prove wide separation, so it neither releases the grip nor breaks an otherwise valid main-hand path. Main-hand loss, board exit, toolbar entry, or an implausible main-hand jump breaks the current path but does not by itself cancel the grip. Stale pose input, controller loss, camera-dimension change, view exit, or session cleanup cancels it.
- Capture-timestamp speed-adaptive smoothing remains scoped to the main-hand drawing cursor and retained path. It does not affect the grip decision, skeleton presentation, button hit testing, or `PosePacket`.

### One selected tool

- Pencil is the default selected tool. A **Pencil/Eraser** action toggles the selected tool; the selection and color survive Draw exit and re-entry within the mounted television session.
- Pencil and eraser share the same two-hand grip, continuity, smoothing, boundary, and main-hand rules.
- The opposite hand has no independent cursor, eraser, dwell state, or drawing path.
- Changing tool, color, or clearing artwork breaks the current path without cancelling a valid grip. The next eligible main-hand sample begins a new path with the selected state.

### Compact left toolbar

- Main Menu and Games retain their frozen overhead rows.
- Draw alone places all four smaller buttons in one vertical column just inside the left edge of the mirrored projected camera frame. This projected frame—not the physical television edge—is the reachable screen.
- The column is vertically centered around the leased pose's torso, clamped fully inside the projected frame, and frozen for the lease. Hit testing and rendered rectangles use the same layout.
- Existing neutral arming, per-button dwell, hover hysteresis, semantic activation, and accessibility behavior remain unchanged.

## Consequences

### Benefits

- Engagement is immediate and deliberate, with no requirement to hold an estimated hand still.
- Large hysteresis keeps an ordinary stroke active and makes release an intentional gesture.
- Pencil and eraser behavior are identical and easier to learn.
- One main-hand cursor eliminates competing tool state and keeps all marks under the controlling hand.
- A compact edge toolbar leaves the center of the camera board available for artwork.

### Costs and risks

- Both complete hands and both visible shoulders are required to start a grip.
- Users must learn the close-to-start and wide-to-stop gesture.
- A lost supporting hand cannot prove release, so the grip remains active until valid wide separation or an existing safety reset is observed.
- The initial body-relative ratios and compact dimensions still require acceptance on the owner's phone and television.

## Alternatives considered

### Toggle drawing with one hand

Rejected because it needs another dwell, pose, or button gesture and does not provide the requested two-hand physical metaphor.

### Activate and release at one hand-distance threshold

Rejected because estimation noise around one boundary would repeatedly split paths. Separate thresholds are the continuity mechanism.

### Keep the opposite-hand eraser

Rejected because it gives each hand a different hidden mode and conflicts with the requested Pencil/Eraser selection.

## Verification

- Draw-domain tests prove immediate activation, no timer, body-relative thresholds, hysteresis continuity, deliberate wide release, main-hand-only output, identical eraser behavior, and fail-closed stale/frame boundaries.
- Pose-control tests prove shoulder-span delivery and a four-action left-column layout fully inside the projected camera bounds while overhead menu placement remains unchanged.
- Component tests prove the dynamic Pencil/Eraser action, one tool cursor, compact vertical button geometry, retained selection, and current instructions.
- The full canonical validation suite must pass before publication.

## Follow-up

- Record real-device comfort, false activation, false release, button reach, and path continuity before changing either ratio or the compact toolbar dimensions.
