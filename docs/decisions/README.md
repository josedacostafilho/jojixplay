---
status: Active
last_verified: 2026-10-08
scope: Architectural decision record process and index
---

# Architectural decision records

ADRs capture durable, consequential choices whose rationale would otherwise be lost. They are not meeting notes, implementation plans, or a place to preserve obsolete code.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-greenfield-hard-cutover.md) | Accepted | Treat the project as greenfield; require hard cutovers and forbid backwards compatibility by default |
| [0002](0002-static-peer-to-peer-runtime.md) | Superseded | Deploy static assets and use decentralized rendezvous for direct WebRTC sessions |
| [0003](0003-client-stack-and-renderer-boundary.md) | Superseded | Use a typed static client with worker inference and a renderer-independent pose boundary |
| [0004](0004-human-readable-pairing-key.md) | Superseded | Use one 100-bit human-readable key for QR and manual session pairing |
| [0005](0005-mirrored-tv-pose-controls.md) | Superseded | Mirror television presentation and use adaptive dwell-based temporary pose controls |
| [0006](0006-session-player-limit-control.md) | Superseded | Default to one-player inference and use an acknowledged television-to-phone command to select one or two players |
| [0007](0007-node-24-and-dependency-maintenance.md) | Accepted | Hard-cut over to Node 24 LTS and validate grouped, immutable dependency updates before deployment |
| [0008](0008-above-head-coarse-hand-controls.md) | Superseded | Place controls above the visible head and use a neutral-gated coarse-hand pointer |
| [0009](0009-camera-paced-inference.md) | Accepted | Remove the arbitrary 15 Hz gate and run serial inference at the camera's bounded cadence |
| [0010](0010-menu-and-draw-game.md) | Superseded | Add body-controlled navigation and the normalized two-hand Draw game |
| [0011](0011-consumer-specific-pose-stability.md) | Superseded | Keep raw pose canonical and use consumer-specific stability evidence and local diagnostics |
| [0012](0012-two-hand-draw-grip.md) | Superseded | Use an immediate hysteretic two-hand grip, one selected Draw tool, and a compact left toolbar |
| [0013](0013-identity-independent-bubbles-game.md) | Superseded | Add a deterministic Bubbles game with screen-side scoring and radius-safe procedural motion |
| [0014](0014-procedural-body-avatar.md) | Superseded | Replace the visible stick skeleton with an isolated, presentation-smoothed procedural body avatar |
| [0015](0015-canonical-camera-orientation.md) | Superseded | Normalize portrait/landscape camera frames before pose consumers and enforce explicit game layout policies |
| [0016](0016-phaser-canvas-racing.md) | Superseded | Add Racing through a lazy, forced-Canvas Phaser runtime with application-owned simulation and pose steering |
| [0017](0017-coarse-torso-lean-racing.md) | Superseded | Hard-cut Racing from a two-hand wheel to calibrated, hysteretic torso-lean steering |
| [0018](0018-all-in-one-phone-play.md) | Superseded | Add direct all-in-one phone play through the shared body playfield with no preview or peer transport |
| [0019](0019-analog-torso-racing.md) | Superseded | Hard-cut Racing to calibrated analog torso steering, a denser authored course, and explicit opponent projection |
| [0020](0020-app-owned-procedural-audio.md) | Superseded | Add one rendering-host procedural Web Audio runtime with trusted activation and shared sound controls |
| [0021](0021-landscape-phone-only.md) | Accepted | Run exclusively on the phone in landscape with external screen mirroring |
| [0022](0022-independent-3d-platform.md) | Accepted | Isolate the new 3D platform, retire games and accept independent partial-body input |
| [0023](0023-portuguese-desenhar.md) | Accepted | Use Brazilian Portuguese and introduce isolated one-/two-person Desenhar |
| [0024](0024-movement-navigation.md) | Accepted | Operate the complete post-setup journey through movement |
| [0025](0025-camera-menu-and-authored-hands.md) | Accepted | Fullscreen camera menus with aligned authored hand controls |
| [0026](0026-circle-menu-pointer.md) | Accepted | Replace hand meshes with bounded index-aim circles |
| [0027](0027-corrida-gesture-camera.md) | Superseded | Keep first-person gesture feedback and normalized pose walls game-owned |
| [0028](0028-contextual-race-actions.md) | Superseded | Disambiguate race gestures by obstacle and share reachable visible race controls |
| [0029](0029-game-owned-controls-and-frame-channel.md) | Accepted | Games own every in-game control; pose frames reach consumers without interface state |
| [0030](0030-body-anchored-menu.md) | Accepted | Attach the game menu to the player's body in the mirror, with rest as the default |
| [0031](0031-host-sensing-service.md) | Accepted | Sense bodies or hands once in the host on a game's request; games interpret |
| [0032](0032-silhouette-trial-and-camera-pixels.md) | Accepted | Sense silhouettes with the pose model's own mask; let games draw the live camera picture |
| [0033](0033-menu-row-and-forgiving-holds.md) | Accepted | Three selectable games in a row, bounded button sizes, and holds that survive tracking flicker |
| [0034](0034-corrida-third-person-puppet.md) | Accepted | Rebuild Corrida as a run controlled by a body-normalized puppet, feel first; its third-person view was replaced by 0038 |
| [0035](0035-corrida-literal-rules.md) | Accepted | Judge Corrida's obstacles literally by the drawn character; drop pose walls and stars; jump logs from a stretch before them, hang from rails |
| [0036](0036-body-in-its-own-space.md) | Accepted | Report each sensed body in its own space (world landmarks) beside its place in the image |
| [0037](0037-camera-chosen-by-looking.md) | Accepted | Let the adult try every camera by touch after starting, remember the choice, and narrow "no persistence" to a privacy rule |
| [0038](0038-corrida-first-person-depth-and-punch.md) | Accepted | Show Corrida through the character's eyes with only its arms, posed in depth, and add punching monsters |

Use [0000-template.md](0000-template.md) for the next record.

## When an ADR is required

Create an ADR for decisions that materially affect multiple components, long-lived contracts, data ownership, security boundaries, deployment, stack/tool selection, or a difficult-to-reverse tradeoff. Routine implementation details belong in code and tests.

## Lifecycle

1. Copy the template to the next zero-padded number and a short kebab-case title.
2. Start as `Proposed` when discussion remains; use `Accepted` only when authorized and ready to govern implementation.
3. Add the record to the index in this file.
4. Link the ADR from affected reference documentation and implementation where useful.
5. To change an accepted decision, create a new ADR that explicitly supersedes it. Update canonical docs and code in the same hard cutover.
6. Delete abandoned proposed ADRs when they no longer provide useful context. Do not accumulate speculative decision debris.

Accepted ADRs are historical records. They may describe former choices, but operational instructions and current architecture must live in their canonical reference documents.
