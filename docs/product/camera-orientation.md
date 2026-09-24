---
status: Active
last_verified: 2026-09-24
scope: Landscape-only output, source normalization, and rotation lifecycle
---

# Landscape camera coordinates

## Entry and output

The website requires landscape before mounting phone setup. The trusted Start action attempts native landscape locking after fullscreen entry. Browser denial never enables portrait play: portrait unmounts the run, releases its resources, and shows the rotate instruction. See [Phone play](local-play.md).

`PosePacket.frame` is exactly `{ width, height, layout, epoch }`, with `layout: "landscape"` and width greater than height. Square and portrait canonical frames are rejected. Raw camera source dimensions may be portrait; this is source metadata, not a playable mode.

## Normalization

The camera parses Screen Orientation type and quarter-turn angle. Source bitmaps already in landscape are browser-oriented and receive no additional rotation. Portrait bitmaps receive the matching `90°` or `270°` turn before MediaPipe; output landmarks are mapped once into upright landscape coordinates. Anatomical indices remain unchanged. Presentation mirrors horizontally only after normalization.

A changed source basis must remain stable for 400 ms before commit. MediaPipe tracking resets and the frame epoch increments. Every temporal consumer resets on epoch changes. Temporarily inconsistent source/screen metadata is dropped for up to 1,500 ms; sustained invalid metadata stops tracking with an actionable error.

## Games and controls

All games and both player counts use landscape. Main Menu, Settings, Games, Draw, and actionable Bubbles/Racing phases use compact left-column targets within the projected camera frame. There are no layout commands, game orientation negotiation, portrait layouts, or captured-layout restoration paths.

Draw and Bubbles preserve the canonical frame aspect ratio. Racing fills the playfield, using a full viewport for one player and side-by-side views for two. All input uses raw canonical landmarks; presentation stabilization never feeds game logic.

Real-device acceptance must cover both landscape directions, source-coordinate alignment, native lock acceptance/rejection, portrait teardown, and external-mirroring behavior. [ADR-0021](../decisions/0021-landscape-phone-only.md) owns the rationale.
