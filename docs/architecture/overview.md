---
status: Active
last_verified: 2026-08-13
scope: Current system shape, boundaries, and architectural constraints
---

# Architecture overview

## Current state

The first runtime architecture is deployed as a static two-role client with phone-local inference, decentralized rendezvous, direct WebRTC pose delivery, and television-local Canvas rendering. No application backend or persistence exists. Complete real-device acceptance remains outstanding.

See [ADR-0002](../decisions/0002-static-peer-to-peer-runtime.md), [ADR-0003](../decisions/0003-client-stack-and-renderer-boundary.md), [ADR-0005](../decisions/0005-mirrored-tv-pose-controls.md), and the [prototype contract](../product/skeleton-viewer.md).

## System flow

```text
GitHub Pages static assets
        │
        ├── TV shell ───── encrypted SDP ──── public Nostr relays
        │      ▲                                  ▲
        │      │ validated PosePacket             │ discovery only
        │      │ direct WebRTC DataChannel        │
        │      │                                  │
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
| Runtime components | Implemented | Preact shell, phone camera controller, MediaPipe worker, peer room, packet validator, Canvas renderer |
| Data flow | Implemented | Camera → worker → strict PosePacket → WebRTC → validator → Canvas |
| Persistence | None | Sessions and pose data are memory-only and ephemeral |
| External integrations | Active | GitHub Pages workflow, Nostr relays through Trystero, browser WebRTC, MediaPipe runtime |
| Authentication/authorization | Possession-based session | One 100-bit key delivered by QR or manual entry derives domain-separated room credentials; exactly opposite phone/TV roles handshake |
| Deployment topology | Published | One static production artifact at `https://josedacostafilho.github.io/jojixplay/` |
| Observability | Local only | User-visible state and non-sensitive development diagnostics; no telemetry service |

## Component ownership

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Application shell | Select role and own page lifecycle | Browser location and capability checks |
| Phone controller | Acquire camera after consent and schedule bounded inference | Browser media APIs |
| Pose worker | Load vendored MediaPipe assets and produce landmark detections | Worker message protocol |
| Pose contract | Validate the only network-domain representation | Reject malformed or obsolete-shaped packets |
| Peer room | Authenticate opposite roles, discover peers, and coalesce pose sends | Trystero/Nostr and WebRTC |
| Skeleton renderer | Draw validated current detections without identity assumptions | Canvas 2D only |
| Pose controls | Claim a temporary controller, project one mirrored wrist, freeze adaptive targets, and emit dwell actions | Validated television-local pose input only |
| TV playfield | Align stage effects, mirrored skeleton, semantic controls, and cursor in one projection | Canvas/DOM presentation boundary |
| TV display | Enter TV mode, create QR/manual-key session, receive packets, and present connection freshness | User-visible session lifecycle |

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
