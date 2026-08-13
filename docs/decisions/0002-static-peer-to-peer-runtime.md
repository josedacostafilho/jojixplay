---
status: Active
last_verified: 2026-08-13
scope: Static deployment, decentralized rendezvous, and peer-to-peer session topology
---

# ADR-0002: Static deployment with decentralized WebRTC rendezvous

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** None
- **Superseded by:** None

## Context

The product must initially cost nothing or almost nothing to operate. Its high-frequency payload is pose landmarks generated on a phone for a nearby television, normally on the same Wi-Fi. Camera pixels are private and must remain on the phone. A continuously active hosted relay would add cost and latency, while ordinary browser pages cannot perform portable local peer discovery without an exchange medium.

The project owner approved a static-only application deployment and an existing public decentralized rendezvous network instead of an owned signaling backend.

## Decision

- Deploy the application as static assets on GitHub Pages.
- Use Trystero's Nostr strategy with a cryptographically random room identifier and separate high-entropy password to exchange encrypted WebRTC setup information.
- Send pose packets through the resulting direct WebRTC DataChannel.
- Do not deploy an application backend, database, owned signaling service, WebSocket pose relay, or TURN service for the prototype.
- Treat rendezvous failure, router client isolation, and unsupported WebRTC as explicit terminal session errors.
- Do not ship a secondary transport or signaling implementation as a fallback.

Public relays may observe network metadata and encrypted signaling traffic, but they must never receive application pose messages through the JojixPlay protocol. No session state is retained by JojixPlay.

## Consequences

### Benefits

- Hosting and application infrastructure can remain free.
- Pose traffic normally takes the local peer-to-peer path with low latency.
- The deployed artifact is static, reproducible, and contains no runtime secrets.
- The project owns no server operations, persistence, or account system.

### Costs and risks

- Pairing requires reachable public Nostr relays and normally requires internet access.
- Public relay reliability is outside project control.
- Some routers isolate Wi-Fi clients, and some television browsers have incomplete WebRTC support.
- Without TURN, a failed direct connection cannot continue through a relay.
- A future reliability requirement may require a hard cutover to a different rendezvous or transport architecture.

## Alternatives considered

### Cloudflare Durable Object signaling or pose relay

Rejected for the first prototype because public rendezvous can remove all owned backend deployment. A continuous pose relay would also consume hosted compute throughout every session.

### PeerJS Cloud

Viable but not selected. It supplies a convenient free public broker but introduces a single central provider, whereas Trystero supports redundant decentralized relays and password-encrypted session descriptions.

### Manual two-way SDP exchange

Rejected because the television normally cannot scan a phone-displayed QR code and the response is not suitable for TV-remote entry.

### Presentation API or Local Peer-to-Peer API

Not selected as the canonical path because receiver support is not portable across generic phone and smart-TV browsers. The Local Peer-to-Peer API is not yet a dependable deployed baseline.

## Verification

- The production artifact contains no server runtime or server deployment configuration.
- Network-facing code uses Trystero only for room discovery and actions only for validated application messages.
- Tests prove that session credentials use Web Crypto, arrive through the URL fragment, are scrubbed after parsing, and are rejected when malformed.
- Code and dependency searches find no TURN configuration or alternate transport.
