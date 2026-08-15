---
status: Active
last_verified: 2026-08-15
scope: Architectural decision record process and index
---

# Architectural decision records

ADRs capture durable, consequential choices whose rationale would otherwise be lost. They are not meeting notes, implementation plans, or a place to preserve obsolete code.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-greenfield-hard-cutover.md) | Accepted | Treat the project as greenfield; require hard cutovers and forbid backwards compatibility by default |
| [0002](0002-static-peer-to-peer-runtime.md) | Accepted | Deploy static assets and use decentralized rendezvous for direct WebRTC sessions |
| [0003](0003-client-stack-and-renderer-boundary.md) | Accepted | Use a typed static client with worker inference and a renderer-independent pose boundary |
| [0004](0004-human-readable-pairing-key.md) | Accepted | Use one 100-bit human-readable key for QR and manual session pairing |
| [0005](0005-mirrored-tv-pose-controls.md) | Accepted | Mirror television presentation and use adaptive dwell-based temporary pose controls |
| [0006](0006-session-player-limit-control.md) | Accepted | Default to one-player inference and use an acknowledged television-to-phone command to select one or two players |
| [0007](0007-node-24-and-dependency-maintenance.md) | Accepted | Hard-cut over to Node 24 LTS and validate grouped, immutable dependency updates before deployment |
| [0008](0008-above-head-coarse-hand-controls.md) | Accepted | Place controls above the visible head and use a neutral-gated coarse-hand pointer |
| [0009](0009-camera-paced-inference.md) | Accepted | Remove the arbitrary 15 Hz gate and run serial inference at the camera's bounded cadence |
| [0010](0010-menu-and-draw-game.md) | Accepted | Add body-controlled navigation and the normalized two-hand Draw game |
| [0011](0011-consumer-specific-pose-stability.md) | Accepted | Keep raw pose canonical and use consumer-specific stability evidence and local diagnostics |
| [0012](0012-two-hand-draw-grip.md) | Accepted | Use an immediate hysteretic two-hand grip, one selected Draw tool, and a compact left toolbar |
| [0013](0013-identity-independent-bubbles-game.md) | Accepted | Add a deterministic Bubbles game with screen-side scoring and radius-safe procedural motion |
| [0014](0014-procedural-body-avatar.md) | Accepted | Replace the visible stick skeleton with an isolated, presentation-smoothed procedural body avatar |
| [0015](0015-canonical-camera-orientation.md) | Accepted | Normalize portrait/landscape camera frames before pose consumers and enforce explicit game layout policies |
| [0016](0016-phaser-canvas-racing.md) | Accepted | Add Racing through a lazy, forced-Canvas Phaser runtime with application-owned simulation and pose steering |

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
