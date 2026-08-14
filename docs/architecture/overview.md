---
status: Active
last_verified: 2026-08-14
scope: Current system shape, boundaries, and architectural constraints
---

# Architecture overview

## Current state

The runtime architecture is a static two-role client with phone-local inference, decentralized rendezvous, direct WebRTC pose delivery, body-controlled navigation, one shared procedural avatar renderer, and separate television-local Canvas renderers for Draw and Bubbles. No application backend or persistence exists. Complete real-device acceptance remains outstanding.

See [ADR-0002](../decisions/0002-static-peer-to-peer-runtime.md), [ADR-0003](../decisions/0003-client-stack-and-renderer-boundary.md), [ADR-0005](../decisions/0005-mirrored-tv-pose-controls.md), [ADR-0006](../decisions/0006-session-player-limit-control.md), [ADR-0008](../decisions/0008-above-head-coarse-hand-controls.md), [ADR-0009](../decisions/0009-camera-paced-inference.md), [ADR-0010](../decisions/0010-menu-and-draw-game.md), [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md), [ADR-0012](../decisions/0012-two-hand-draw-grip.md), [ADR-0013](../decisions/0013-identity-independent-bubbles-game.md), [ADR-0014](../decisions/0014-procedural-body-avatar.md), and the current product contracts in [`../product/`](../product/).

## System flow

```text
GitHub Pages static assets
        │
        ├── TV shell ───── encrypted SDP ──── public Nostr relays
        │      ▲  │                               ▲
        │      │  │ pose-limit request            │ discovery only
        │      │  ▼ and acknowledgement           │
        │      │ direct WebRTC DataChannel        │
        │      │ validated PosePacket             │
        └── Phone shell + camera + MediaPipe worker
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
| Runtime components | Implemented | Preact shell, phone camera controller, MediaPipe worker, player-limit contract, peer room, packet validator, pose controls, isolated avatar presentation sessions, and separate Canvas renderers |
| Data flow | Implemented | Camera → worker → strict raw PosePacket → WebRTC → validator → raw interaction consumers plus isolated avatar display copy → Canvas; TV → strict player-limit request → phone reconfiguration → matching acknowledgement |
| Persistence | None | Sessions and pose data are memory-only and ephemeral |
| External integrations | Active | GitHub Pages workflow, Nostr relays through Trystero, browser WebRTC, MediaPipe runtime |
| Authentication/authorization | Possession-based session | One 100-bit key delivered by QR or manual entry derives domain-separated room credentials; exactly opposite phone/TV roles handshake |
| Deployment topology | Published | One static production artifact at `https://josedacostafilho.github.io/jojixplay/` |
| Observability | Local only | User-visible state plus bounded phone-local cadence, processing-age, and motion-spread aggregates; no telemetry service |

## Component ownership

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Application shell | Select role and own page lifecycle | Browser location and capability checks |
| Phone controller | Acquire camera after consent, schedule camera-paced single-flight inference, own the current pairing-session pose limit, and publish bounded local pose diagnostics | Browser media APIs and monotonic camera timestamps |
| Pose worker | Load vendored MediaPipe assets, produce landmark detections, and reconfigure the one-/two-pose graph in place | Worker message protocol |
| Pose contract | Validate the only network-domain representation | Reject malformed or obsolete-shaped packets |
| Pose features | Derive the one canonical complete coarse hand from validated landmarks | Pure domain input; no temporal or transport state |
| Pose diagnostics | Aggregate two-second camera/inference rates, processing age, and one-player coarse-hand spread | Phone memory only; no coordinates leave the monitor |
| Player-limit contract | Define and strictly parse the only reverse session command | Reject values other than exact one- or two-pose objects |
| Peer room | Authenticate opposite roles, discover peers, coalesce pose sends, and coordinate acknowledged player-limit requests | Trystero/Nostr and WebRTC |
| Avatar presentation | Produce one immutable display copy per canvas; adaptively stabilize only continuous one-pose input and reset on zero/multiple poses or discontinuity | Presentation-local state; never an interaction or identity source |
| Avatar renderer | Synthesize the sole faceless body view from bounded procedural head, torso, limb, joint, complete-hand, and complete-foot primitives | Canvas 2D only; no assets, engine, or stick-skeleton fallback |
| Pose controls | Claim through wrist gestures, expose both coarse hands plus aspect-corrected shoulder span, freeze overhead rows or compact left columns, neutral-arm, emit action-specific dwell events, and suspend activation during active games | Validated television-local pose input only |
| TV playfield | Own Main Menu/Games/Draw/Bubbles navigation and phase-specific action surfaces, align the shared projection, and preserve or reset each game's explicitly scoped ephemeral state | Preact lifecycle and semantic-control boundary |
| Draw session | Own the Pencil/Eraser selection, immediate two-hand grip hysteresis, responsive main-hand path smoothing, and path-breaking rules in normalized camera coordinates | Pure television-local game domain |
| Draw renderer | Incrementally render mirrored Pencil/Eraser paths inside the projected white camera board | Canvas 2D only |
| Bubbles input adapter | Derive mirrored complete hands and current left/right screen slots from validated poses without creating identity | Pure current-packet domain transformation |
| Bubbles session | Own readiness, exact round deadlines, normalized bubble simulation, swept collisions, side scores, pop lifecycle, and results | Pure television-local game domain with injected randomness for tests |
| Bubbles renderer | Procedurally draw bubble bodies, bounded pop effects, score feedback, and hand hit rings inside the projected camera arena | Canvas 2D only; no downloaded assets |
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
