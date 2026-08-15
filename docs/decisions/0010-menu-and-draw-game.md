---
status: Active
last_verified: 2026-08-14
scope: Television navigation, first game lifecycle, Draw interaction, coordinates, and rendering
---

# ADR-0010: Body-controlled menus and the Draw game

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The Circles prototype action and circle-effect layer in [ADR-0005](0005-mirrored-tv-pose-controls.md), including the retained circle references in [ADR-0006](0006-session-player-limit-control.md)
- **Superseded by:** [ADR-0011](0011-consumer-specific-pose-stability.md) for temporal-signal ownership; [ADR-0012](0012-two-hand-draw-grip.md) for Draw engagement, tool ownership, and toolbar placement; [ADR-0014](0014-procedural-body-avatar.md) for the reduced-opacity body layer; [ADR-0015](0015-canonical-camera-orientation.md) for canonical camera coordinates, frame epochs, and Draw's layout lock

## Context

The skeleton viewer proved the phone-to-television pipeline with three placeholder actions. The application now needs its first content hierarchy and continuous game input without coupling the shell to a general-purpose game engine. Draw is the first game because it exercises navigation, normalized pose input, two-hand interaction, persistent television-local game state, and direct Canvas 2D rendering.

Continuous drawing also needs an explicit pen-up/pen-down contract. Treating every visible hand movement as ink would create strokes while the player repositions or reaches for controls. Pose Landmarker has no reliable pinch signal at full-body distance, and adding Hand Landmarker remains unjustified.

## Decision

### Navigation and control surfaces

- The television owns one explicit view state: **Main Menu**, **Games**, or **Draw**.
- Main Menu contains **Background**, dynamic **Players: 1/2**, and **Games**. **Games** replaces **Circles**, and the entire circle effect is deleted.
- Games contains **Draw** and **Return**. **Return** goes to Main Menu.
- Draw contains **Color**, **Clear**, and **Exit**. **Exit** goes to Games.
- A view transition retains the temporary controller lease but atomically replaces its complete action set, clears hover/dwell/latching, and requires the controlling hand to leave the new targets before body activation arms.
- Every view supplies one to three typed actions to the shared frozen above-head layout. Buttons remain semantic and accessible to a television remote or keyboard.
- Drawings remain in television memory when navigating away from and back to Draw. They are erased only by **Clear** or when the television playfield session ends; there is no persistence.

### Drawing surface and coordinates

- The drawable surface is exactly the current contained phone-camera projection. It is white with a visible boundary; letterboxed television space remains dark and is never drawable.
- Store brush and eraser paths as normalized, unmirrored camera coordinates. Apply the existing television mirror only while rendering.
- Television viewport changes reproject the normalized drawing. A camera frame-dimension change immediately lifts both tools and requires deliberate re-engagement before new marks are accepted.
- Render in this order: dark television stage, white drawable surface, accumulated drawing, live body presentation at reduced opacity, semantic controls, then tool cursors and status guidance.
- Draw uses Canvas 2D directly and introduces no game engine or persistence dependency.

### Hands and tool engagement

- The hand selected by the controller claim is the brush. The opposite hand is the eraser. Both use the complete wrist/pinky/index/thumb centroid from the currently leased pose.
- A tool with any unusable coarse-hand landmark is unavailable and immediately lifts. There is no wrist, other-hand, or last-position fallback.
- A visible tool begins in hover. Holding it within a small stationary region on the drawable surface for 500 ms engages it; holding an engaged tool still for another 500 ms lifts it.
- Only one tool may be engaged. Engaging one lifts the other.
- Entering any toolbar target, leaving the drawable surface, pose staleness/dropout, an implausibly large hand jump, or a camera frame-dimension change lifts the affected tool and breaks its current path.
- Apply modest speed-aware smoothing to each complete hand. Store only sufficiently separated points and render paths with round caps and joins. Smoothing may reduce noise but must not invent a connection across a gap or jump.

### Tools and destructive behavior

- The brush cycles through a fixed opaque palette: near-black, blue, red, and green. **Color** shows the active swatch and advances exactly one color.
- The eraser removes drawing through a fixed circular path and never alters the white surface or live body layer.
- **Clear** uses a 1,500 ms dwell, longer than the normal 900 ms menu dwell, and atomically removes all accumulated drawing.
- Tool cursors distinguish brush color, eraser radius, engagement state, and 500 ms dwell progress.

### Camera movement

- Draw is screen/camera-frame anchored, not room-anchored augmented reality. Existing artwork stays fixed on the television when the physical phone moves; the live body and new input shift relative to it.
- Pose landmarks alone cannot distinguish camera movement from all visible people moving together. Do not add speculative body-relative camera compensation.
- A stationary phone mount is the operating expectation. Sudden-point guards limit accidental marks after bumps but do not claim camera stabilization.

## Consequences

### Benefits

- The first game consumes the established pose-domain boundary without changing privacy or transport contracts.
- Menu transitions and game actions use one accessible body-control system instead of per-screen interaction implementations.
- Normalized paths survive television resizing and never enter unreachable letterbox space.
- Independent brush and eraser cursors exercise both pose hands without a detailed hand model.

### Costs and risks

- Dwell-to-engage is an experimental continuous-input gesture and requires real-device tuning.
- Full-body coarse hands and 30 FPS-or-lower inference can still produce visible noise or lost points.
- Retained segments and replay work grow with drawing length; long-session memory and resize behavior must be observed on target televisions before setting an explicit bound.
- Physical camera movement cannot be corrected from the transmitted data.

## Alternatives considered

### Draw whenever the hand is visible

Rejected because repositioning and toolbar reaches would create unavoidable accidental marks.

### Use wrist height as pen-down

Rejected because it would make portions of the canvas unreachable or reproduce the earlier elbow-height contradiction.

### Use hand depth or a pinch gesture

Rejected because pose depth and coarse finger points do not provide a sufficiently established full-body gesture. Hand Landmarker would add a second model before measurement demonstrates a need.

### Store television pixels instead of normalized paths

Rejected because resize would lose or blur the drawing, erasing would be harder to replay correctly, and game state would become coupled to one viewport size.

## Verification

- Unit tests prove variable menu layouts, view-transition neutral arming, action-specific dwell, both-hand extraction, tool engagement/lifting, one-active-tool arbitration, smoothing boundaries, jump/dropout behavior, color cycling, clearing, and normalized path retention.
- Component tests prove semantic navigation, dynamic labels, white projected bounds, reduced-opacity body presentation, persistent in-session art, and accessible Draw actions.
- Renderer tests prove mirrored normalized brush/eraser paths and correct clear/composite behavior.
- Real-device acceptance must record Draw latency, path quality, dwell ergonomics, eraser control, camera-bump behavior, thermal behavior, and long-session rendering.
