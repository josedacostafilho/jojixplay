---
status: Active
last_verified: 2026-08-15
scope: Current system shape, boundaries, and architectural constraints
---

# Architecture overview

## Current state

The runtime architecture is a static two-role client with phone-local orientation normalization and inference, decentralized rendezvous, direct WebRTC pose delivery, orientation-aware body-controlled navigation, one shared procedural avatar renderer, focused television-local Canvas renderers for Draw and Bubbles, and one lazy forced-Canvas Phaser adapter for Racing. No application backend or persistence exists. Complete real-device acceptance remains outstanding.

See [ADR-0002](../decisions/0002-static-peer-to-peer-runtime.md), [ADR-0003](../decisions/0003-client-stack-and-renderer-boundary.md), [ADR-0005](../decisions/0005-mirrored-tv-pose-controls.md), [ADR-0006](../decisions/0006-session-player-limit-control.md), [ADR-0008](../decisions/0008-above-head-coarse-hand-controls.md), [ADR-0009](../decisions/0009-camera-paced-inference.md), [ADR-0010](../decisions/0010-menu-and-draw-game.md), [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md), [ADR-0012](../decisions/0012-two-hand-draw-grip.md), [ADR-0013](../decisions/0013-identity-independent-bubbles-game.md), [ADR-0014](../decisions/0014-procedural-body-avatar.md), [ADR-0015](../decisions/0015-canonical-camera-orientation.md), [ADR-0016](../decisions/0016-phaser-canvas-racing.md), and the current product contracts in [`../product/`](../product/).

## System flow

```text
GitHub Pages static assets
        │
        ├── TV shell ───── encrypted SDP ──── public Nostr relays
        │      ▲  │                               ▲
        │      │  │ pose-limit / layout request   │ discovery only
        │      │  ▼ and exact acknowledgement     │
        │      │ direct WebRTC DataChannel        │
        │      │ validated canonical PosePacket   │
        └── Phone shell + camera → rotation normalization → MediaPipe worker
```

Camera pixels flow only from the phone camera to the phone worker and local preview. They do not enter Trystero, WebRTC, storage, or logs.

## Governing constraints

Any initial architecture must satisfy these constraints:

- Implement the smallest complete vertical slice that validates real product behavior.
- Maintain one canonical path for each capability; hard-cutover replacements are mandatory.
- Separate domain rules from delivery mechanisms and vendors when there is a real boundary to protect.
- Make dependency direction explicit and avoid circular dependencies.
- Validate input and authentication/authorization at owned trust boundaries.
- Keep configuration explicit and validated at process startup.
- Make state ownership, transaction boundaries, idempotency needs, and failure semantics explicit.
- Keep long-lived sensitive data out of logs, build artifacts, examples, and fixtures; keep ephemeral pairing keys confined to the intentional QR-fragment or manual-entry flow and runtime memory.
- Design interfaces for accessibility and operational behavior for observability from the first implemented slice.
- Avoid speculative services, repositories, adapters, event buses, plugin systems, and generic abstraction layers without a demonstrated consumer.

These constraints supplement the invariants in [`../../AGENTS.md`](../../AGENTS.md).

## Architecture registry

| Concern | Current state | Canonical detail |
| --- | --- | --- |
| System context | Implemented | One phone controller, one television display, public rendezvous relays, static host |
| Runtime components | Implemented | Preact shell, camera-orientation contract, phone camera controller, MediaPipe worker, player-limit/game-policy contracts, peer room, packet validator, pose controls, isolated avatar presentation sessions, focused Draw/Bubbles Canvas renderers, and a lazy Phaser Canvas Racing adapter |
| Data flow | Implemented | Camera bitmap + Screen Orientation → phone-owned quarter-turn normalization → MediaPipe → strict unsmoothed canonical PosePacket → WebRTC → validator → consumer-specific controls/Draw/Bubbles/Racing input plus isolated avatar display copy → owned Canvas renderer; TV → strict player-limit or camera-layout request → phone application → matching acknowledgement |
| Persistence | None | Sessions and pose data are memory-only and ephemeral |
| External integrations | Active | GitHub Pages workflow, Nostr relays through Trystero, browser WebRTC, MediaPipe runtime |
| Authentication/authorization | Possession-based session | One 100-bit key delivered by QR or manual entry derives domain-separated room credentials; exactly opposite phone/TV roles handshake |
| Deployment topology | Published | One static production artifact at `https://josedacostafilho.github.io/jojixplay/` |
| Observability | Local only | User-visible state plus bounded phone-local cadence, processing-age, and motion-spread aggregates; no telemetry service |

## Component ownership

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Application shell | Select role and own page lifecycle | Browser location and capability checks |
| Camera contract | Validate layout, source/canonical dimensions, screen orientation, quarter turns, frame epochs, and strict layout messages | Pure phone/domain boundary with no browser fallback |
| Phone controller | Acquire camera after consent, schedule camera-paced single-flight inference, stabilize basis changes, own pose-limit/layout requests, and publish bounded local pose/orientation diagnostics | Browser media, Screen Orientation, and monotonic camera timestamps |
| Pose worker | Load vendored MediaPipe assets, apply the requested input rotation, map unrotated output landmarks into canonical space, reset tracking across basis changes, and reconfigure the one-/two-pose graph | Worker message protocol |
| Pose contract | Validate the only network-domain representation, including canonical layout and epoch | Reject malformed or obsolete-shaped packets |
| Pose features | Derive the one canonical complete coarse hand from validated landmarks | Pure domain input; no temporal or transport state |
| Pose diagnostics | Aggregate current orientation normalization plus two-second camera/inference rates, processing age, and one-player coarse-hand spread | Phone memory only; no coordinates or aggregates leave the monitor |
| Player-limit contract | Define and strictly parse the only reverse session command | Reject values other than exact one- or two-pose objects |
| Game catalog | Own each game's supported layouts for the acknowledged player count | Pure typed shell policy; renderers never inspect browser orientation |
| Peer room | Authenticate opposite roles, discover peers, coalesce pose sends, and coordinate acknowledged player-limit and camera-layout requests | Trystero/Nostr and WebRTC |
| Avatar presentation | Produce one immutable display copy per canvas; adaptively stabilize only continuous one-pose input and reset on zero/multiple poses or discontinuity | Presentation-local state; never an interaction or identity source |
| Avatar renderer | Synthesize the sole faceless body view from bounded procedural head, torso, limb, joint, complete-hand, and complete-foot primitives | Canvas 2D only; no assets, engine, or stick-skeleton fallback |
| Pose controls | Claim through wrist gestures, expose both coarse hands plus aspect-corrected shoulder span, freeze portrait overhead rows or compact left columns, reset on frame epochs, neutral-arm, emit action-specific dwell events, and suspend activation during active games | Validated television-local canonical pose input only |
| TV playfield | Own Main Menu/Games/Draw/Bubbles/Racing navigation, orientation gates and active-game locks, phase-specific action surfaces, shared control projection, and each game's preserve/reset/pause policy | Preact lifecycle, game-policy, and semantic-control boundary |
| Draw session | Own the Pencil/Eraser selection, immediate two-hand grip hysteresis, responsive main-hand path smoothing, and path-breaking rules in normalized camera coordinates | Pure television-local game domain |
| Draw renderer | Incrementally render mirrored Pencil/Eraser paths inside the projected white camera board | Canvas 2D only |
| Bubbles input adapter | Derive mirrored complete hands and current left/right screen slots from validated poses without creating identity | Pure current-packet domain transformation |
| Bubbles session | Own readiness, exact round deadlines, normalized bubble simulation, swept collisions, side scores, pop lifecycle, and results | Pure television-local game domain with injected randomness for tests |
| Bubbles renderer | Procedurally draw bubble bodies, bounded pop effects, score feedback, and hand hit rings inside the projected camera arena | Canvas 2D only; no downloaded assets |
| Racing input | Derive aspect-corrected two-hand wheel angles, overhead pause gestures, and bounded temporary Solo/Left/Right leases from raw canonical poses | Pure television-local input; no avatar values or stable identity |
| Racing session | Own valid-input calibration, automatic throttle, fixed-step car rules, pause/recenter/restart, active elapsed time, and finish results | Pure deterministic TypeScript domain; no Preact, Phaser, transport, or browser dependency |
| Racing track/projection | Build one deterministic segmented course and project bounded road/object geometry for full or half television viewports | Pure immutable TypeScript geometry shared only with Racing |
| Racing runtime | Lazy-load one Phaser instance, force Canvas, own one/two view cameras, procedural road/car/HUD drawing, resize, visibility pause, errors, and complete teardown | Racing-only vendor adapter; consumes the pure session and projection, never pose packets or transport objects |
| TV display | Enter TV mode, create QR/manual-key session, receive packets, own acknowledged TV mode, and present connection freshness | User-visible session lifecycle |

## Required component documentation

When a component is introduced, add a concise entry covering:

1. Its single responsibility and owned data.
2. Its public interface and callers.
3. Its dependencies and dependency direction.
4. Its trust boundary and validation responsibility.
5. Its failure, retry, timeout, and idempotency behavior where applicable.
6. Its test level and operational signals.

Prefer a compact table or flow diagram only when relationships are difficult to explain linearly. Do not maintain diagrams that duplicate code without adding boundary or ownership information.

## Change rule

Architecture changes use hard cutovers. Update every dependent component and delete the former boundary, contract, configuration, and documentation in the same change. Do not introduce versioned internal interfaces, bridge layers, or parallel data paths unless an explicitly authorized requirement makes them unavoidable.
