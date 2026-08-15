---
status: Active
last_verified: 2026-08-15
scope: Camera rotation normalization, frame epochs, game layout policies, and orientation transitions
---

# ADR-0015: Normalize camera orientation before pose consumers

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The orientation-implicit packet, unmodified-MediaPipe-coordinate wording, fixed menu placement, and frame-dimension-only reset portions of [ADR-0005](0005-mirrored-tv-pose-controls.md), [ADR-0008](0008-above-head-coarse-hand-controls.md), [ADR-0010](0010-menu-and-draw-game.md), [ADR-0011](0011-consumer-specific-pose-stability.md), [ADR-0012](0012-two-hand-draw-grip.md), [ADR-0013](0013-identity-independent-bubbles-game.md), and [ADR-0014](0014-procedural-body-avatar.md)
- **Superseded by:** [ADR-0016](0016-phaser-canvas-racing.md) for the four-item Games menu's compact left-column placement in both layouts and Racing's layout policy; all camera normalization, frame, request, and active-game safety rules remain active

> **Current-scope note:** The original portrait Games above-head row below is historical. Games now uses one compact left column in both layouts; Main Menu retains the portrait above-head row.

## Context

The implemented camera path transfers an `ImageBitmap` directly to MediaPipe and assumes that bitmap `x` is physical horizontal and `y` is physical downward. Some mobile browsers keep camera pixels in a natural-device basis after the screen turns. MediaPipe then receives a sideways person, and the television's otherwise correct `x → 1 - x` mirror appears to operate vertically.

Portrait and landscape are also product inputs rather than incidental browser states. A game may require one layout, accept either, or vary its requirement with the acknowledged player count. Games must not independently infer orientation, rotate landmarks, stretch the television arena, or silently reflow active state across a coordinate-basis change.

Nominal aspect ratio does not determine camera field of view. A `4:3` output does not inherently add vertical coverage; it may only remove horizontal coverage. Crop behavior is camera-mode and device dependent and must be measured rather than inferred from `width / height`.

## Decision

### Canonical camera basis

- Require the phone's Screen Orientation API in addition to the existing camera baseline.
- Read the current screen layout and quarter-turn angle at the phone camera boundary. Compare the actual source-bitmap dimensions with the screen layout to avoid rotating an already orientation-correct source twice. A source whose layout already matches the screen receives no correction, including in a secondary screen orientation; a mismatched source receives only the corresponding `90°` or `270°` correction.
- Apply exactly one phone-owned rotation of `0°`, `90°`, `180°`, or `270°` before pose results enter the application domain. MediaPipe receives its supported clockwise image-processing rotation, and its returned normalized image landmarks are transformed into the same upright canonical frame.
- A canonical frame always has `x` increasing visually rightward and `y` increasing downward. Portrait means `width < height`; landscape means `width > height`. Square or inconsistent frames fail clearly instead of entering pose consumers.
- Keep anatomical left/right landmark indices and relative depth untouched. The television then applies only its established horizontal presentation mirror. Source rotation is phone-local and is never transmitted.
- Preserve the actual selected camera mode and aspect ratio. The application does not force `4:3`, infer field of view from aspect ratio, crop to match the television, or stretch the camera projection.

### Frame contract and transition safety

- Hard-cut `PosePacket.frame` to `{ width, height, layout, epoch }`. `layout` is `portrait | landscape`; `epoch` is a non-negative increasing phone-local camera-basis identifier.
- Increment the epoch whenever source rotation, canonical dimensions, or canonical layout changes. A short stable interval is required before committing a changed basis; inference pauses during the unsettled interval, and brief inconsistent source/screen metadata is treated as transitional before a persistent invalid state fails closed.
- Reset MediaPipe's video-tracking history through its existing in-worker reconfiguration boundary before publishing a newly committed basis. This prevents a tracked region from the previous orientation crossing into the new one without restarting camera capture or changing the acknowledged player limit.
- Bump the peer handshake protocol. Obsolete packets without `layout` and `epoch` and obsolete peers are rejected; no tolerant parser or compatibility route remains.
- Every temporal consumer resets input history on an epoch change even when dimensions happen to match. This includes controller claims, dwell, Draw grip/path continuity, Bubbles hand sweeps, pose diagnostics, and avatar presentation.

### Game layout policy

- The application shell owns one typed orientation policy for every game. A policy exposes the layouts supported for the current acknowledged player count.
- Draw supports portrait and landscape. One-player Bubbles supports portrait and landscape. Two-player Bubbles requires landscape.
- Main Menu and Games accept either layout. Their portrait controls use the frozen above-head row; their landscape controls use the frozen compact left column so the shell consumes lateral rather than scarce overhead space.
- Selecting an incompatible game suspends controls and opens one orientation gate. The television requests the required absolute layout from the phone; the phone shows the same instruction and acknowledges only after that canonical layout is active. The game mounts only after the matching packet arrives.
- A request timeout leaves the current view and layout unchanged and restores neutrally armed controls. No connection, camera, or player-limit restart is required.

### Active-game orientation

- A game captures its camera layout on entry. Supporting both layouts means it may start in either; it does not mean the game is hot-rotatable.
- A packet from another layout is withheld from the active game and avatar. Controls release immediately, Draw cancels its grip and current path while retaining artwork/tool/color, and Bubbles freezes its countdown, round deadline, simulation, effects, and score.
- The television instructs the user to return to the game's captured layout. Matching stable packets resume the same game state with fresh gesture and collision histories.
- A deliberate layout change occurs at a menu/game-entry boundary. Existing Draw art is retained only while returning to the same captured layout; entering Draw under a different layout starts a new canvas. Leaving Bubbles retains its existing reset-on-exit behavior.
- Screen-orientation locking is not a correctness dependency. Browser lock requests have platform preconditions and do not replace observing and validating the actual camera frame.

### Diagnostics and preview

- The collapsed phone diagnostics surface reports the screen type/angle, source dimensions, applied rotation, canonical dimensions/layout, and epoch without logging, persisting, or transmitting them.
- The phone camera stage adopts the canonical aspect ratio. Its video preview applies the same phone-local rotation as inference, and the avatar overlay consumes the canonical packet so both occupy one coordinate basis.
- Television rendering continues to contain the canonical frame. Interactive targets remain inside it; noninteractive HUD content may use surrounding television space.

## Consequences

### Benefits

- MediaPipe always receives an upright person, while every downstream consumer sees one orientation-independent coordinate contract.
- Horizontal mirroring is correct in both layouts and remains separate from anatomical landmark meaning.
- Game requirements are explicit and testable without coupling renderers to phone APIs or transport details.
- Epochs expose coordinate discontinuities that dimensions alone cannot represent.
- Active drawing and timed rounds cannot be corrupted by a silent hot rotation.

### Costs and risks

- Rotation correctness still requires real-device acceptance across the owner's phone/browser and both landscape directions.
- MediaPipe's rotation path and landmark reprojection add fixed per-frame arithmetic; target-device cadence and processing age must be measured.
- Requiring Screen Orientation excludes browsers that cannot provide a validated quarter-turn. The prototype fails explicitly rather than carrying a browser-specific fallback.
- A two-player Bubbles session requires enough landscape framing for two full bodies; camera placement remains a physical setup constraint independent of nominal aspect ratio.

## Alternatives considered

### Change the television mirror axis in landscape

Rejected because the detector would still receive a sideways body and every game would inherit inconsistent axes.

### Rotate only the returned landmarks

Rejected because MediaPipe must see upright pixels for reliable detection. Landmark-only correction happens too late.

### Force a `4:3` stream

Rejected because aspect ratio alone proves nothing about top/bottom field of view and can discard useful horizontal coverage.

### Hot-reflow games across orientation changes

Rejected because normalized artwork, targets, gesture history, collision sweeps, and timed state would change physical meaning during play.

### Ship canvas and MediaPipe rotation fallbacks

Rejected because this greenfield project requires one canonical path. Target-device evidence may justify a future hard-cut replacement, never parallel runtime paths.

## Verification

- Pure tests prove screen-orientation parsing, source/canonical dimension resolution, every quarter-turn landmark transform, layout validation, epoch-sensitive packet parsing, and game policies.
- Worker/controller tests prove MediaPipe rotation options, canonical packet production, stable basis changes, paused inference, layout requests, acknowledgement, diagnostics, and cleanup.
- Transport tests prove strict layout request/acknowledgement, authorization, timeout, malformed-message termination, and the peer-protocol hard cutover.
- Control, Draw, Bubbles, avatar, and playfield tests prove epoch resets, orientation-specific control placement, game-entry gates, paused game behavior, same-layout resumption, and no mismatched packet consumption.
- Real-device acceptance covers portrait, both landscape directions, phone preview alignment, MediaPipe accuracy, horizontal TV mirroring, game gating, accidental rotation/resume, cadence, processing age, and thermals.
