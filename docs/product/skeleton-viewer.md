---
status: Active
last_verified: 2026-08-13
scope: First vertical slice contract, acceptance criteria, and implementation plan
---

# Skeleton-viewer prototype

## Implementation state

Deployed to GitHub Pages. The deterministic automated suite and production-like fake-camera browser journey cover the software-owned acceptance surface. Complete real phone/television acceptance remains outstanding and is tracked in [Project status](../project/status.md).

## Implementation map

| Concern | Canonical implementation |
| --- | --- |
| Role routing and page lifecycle | [`src/app.tsx`](../../src/app.tsx) and [`src/pages/`](../../src/pages/) |
| Pairing credentials and fragment contract | [`src/session/credentials.ts`](../../src/session/credentials.ts) |
| Camera scheduling and cleanup | [`src/pose/camera-pose-controller.ts`](../../src/pose/camera-pose-controller.ts) |
| MediaPipe isolation and worker protocol | [`src/pose/`](../../src/pose/) |
| Pose packet validation and ordering | [`src/domain/pose.ts`](../../src/domain/pose.ts) |
| Peer authentication and WebRTC actions | [`src/transport/peer-room.ts`](../../src/transport/peer-room.ts) |
| Backpressure policy | [`src/transport/latest-sender.ts`](../../src/transport/latest-sender.ts) |
| Renderer geometry and drawing | [`src/render/`](../../src/render/) and [`src/components/skeleton-canvas.tsx`](../../src/components/skeleton-canvas.tsx) |
| Television pose controls | [`src/interaction/pose-controls.ts`](../../src/interaction/pose-controls.ts) and [`src/components/tv-playfield.tsx`](../../src/components/tv-playfield.tsx) |
| Production deployment | [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) |

## Selected behavior

### Television

- The television selects the `tv` role from the static application.
- It waits for one trusted television-side **Start TV mode** activation, requests fullscreen on a best-effort basis, and only then creates and joins a pairing session.
- It creates a cryptographically random 20-character Crockford base32 pairing key with 100 bits of entropy and displays it in five readable groups.
- It derives a 128-bit room value and 192-bit password representation from that key with purpose-separated SHA-256 inputs, then joins through Trystero's Nostr strategy.
- It displays both a QR link carrying the key in its URL fragment and the same key for manual phone entry.
- It accepts one phone peer, validates every received packet, and renders the newest valid packet on a Canvas 2D surface.
- It mirrors the contained pose presentation horizontally without changing anatomical landmark indices or network data.
- It shows explicit waiting, connected, stale-signal, disconnected, unsupported, and fatal-error states.

### Phone

- The phone obtains the pairing key from the QR fragment or a validated manual-entry form. It immediately removes a QR fragment from the visible history entry; fragments are not sent to the static host in HTTP requests.
- Manual entry is case-insensitive, groups the key for readability, and normalizes the ambiguous Crockford characters O, I, and L. Both entry methods feed the same key derivation and session path.
- Camera capture begins only after a user action and explicit browser permission.
- Camera capture prefers the user-facing (selfie) camera.
- MediaPipe Pose Landmarker Lite runs in a module worker with a maximum of two poses.
- Inference is sampled at no more than 15 frames per second.
- The phone previews its camera and latest local skeleton, and sends pose packets only while a peer is connected.
- Stopping or leaving closes the worker, camera tracks, room, and peer connection.

### Pairing and transport

- Both peers derive the same room and password from the ephemeral pairing key and use them through Trystero's public Nostr rendezvous network.
- Every new TV session creates a fresh key. The television stops displaying the key and QR after a phone connects.
- WebRTC DataChannels carry application data directly after discovery.
- No owned signaling service, WebSocket pose relay, TURN server, or transport fallback is implemented.
- If public rendezvous or a direct WebRTC connection fails, the application reports the failure and asks the user to retry the session.

## Pose packet contract

The canonical serialized packet is a strict JSON-compatible object:

```text
PosePacket
├── sequence: non-negative integer, increasing per phone session
├── capturedAtMs: finite monotonic phone timestamp
├── frame
│   ├── width: positive integer, at most 16,384
│   └── height: positive integer, at most 16,384
└── poses: array with 0..2 items
    └── landmarks: exactly 33 items
        ├── x: finite normalized image coordinate
        ├── y: finite normalized image coordinate
        ├── z: finite relative depth
        └── visibility: finite value from 0 through 1
```

No schema version, person ID, camera image, user identifier, or arbitrary extension fields are permitted. Schema changes are hard cutovers. Receivers reject malformed packets and ignore non-increasing sequence numbers.

The sender retains at most one pending packet while an earlier send is in progress. A newer packet replaces the pending packet so transport backpressure cannot create an unbounded stale-frame queue.

## Rendering contract

- Canvas 2D is the intentional renderer for this prototype.
- The renderer consumes only validated `PosePacket` values and has no dependency on MediaPipe or Trystero.
- Source aspect ratio is preserved with contain-style letterboxing.
- The television applies one shared horizontal mirror projection to its skeleton, effects, cursor, adaptive button layout, and hit testing. The phone preview is not changed by this television-only rule.
- Landmarks below the visibility threshold are not connected or drawn.
- Per-frame colors may distinguish simultaneous detections but never imply stable identity. The complete palette toggles between teal/rose and amber/violet.
- A packet older than one second in television receive time is stale and must not remain presented as live.
- The future game host will consume the same validated pose-domain boundary, while each game will own its selected rendering implementation.

## Body-control contract

- Buttons appear only after a temporary controller claim. Before that, a visible single person is prompted to raise either hand; with multiple visible people, one person is prompted to raise both hands.
- A single-person claim requires one wrist above its elbow for 300 ms. A multiperson claim requires both wrists above the shoulders for 500 ms.
- The claim selects one wrist as a direct mirrored pointer. Raising is an engagement gesture only; the active pointer may move below its elbow.
- The television uses short-lived nearest-torso continuity only to survive pose-array reordering. It creates no stable skeleton or player identifier.
- The three-button row is anchored one-quarter of the way from the shoulder midpoint to the hip midpoint, centered on the torso, clamped within the projected camera viewport, and frozen until release.
- A button activates after a 900 ms dwell, activates only once until the pointer leaves, and shows progress while dwelling.
- Control releases after 600 ms below the hips, one second without the controlling pose, 600 ms materially displaced from the frozen layout, 15 seconds without pointer activity, or a viewport change.
- The prototype buttons toggle a fixed background theme, toggle the complete skeleton palette, and replace the current effect with 12 palette-colored circles that fade within three seconds.
- Buttons remain semantic and remotely clickable. Body interactions are the canonical in-session path; the semantic path preserves television-remote and accessibility operation.

The durable rationale and exact coordinate rule are governed by [ADR-0005](../decisions/0005-mirrored-tv-pose-controls.md).

## Capability baseline

The phone must support secure-context camera capture, WebAssembly, WebGL 2, module workers, `createImageBitmap`, `requestVideoFrameCallback`, Web Crypto, WebSockets, and WebRTC DataChannels. The television must support ES modules, Web Crypto, WebSockets, WebRTC DataChannels, ResizeObserver, and Canvas 2D. WebGL 2 is part of the phone's MediaPipe baseline; the television skeleton viewer intentionally requires only Canvas 2D.

Unsupported capabilities produce a specific blocking message. The prototype does not add polyfills or alternate execution paths.

## Privacy and security

- Pairing keys use `crypto.getRandomValues`; `Math.random` is forbidden for pairing.
- A pairing key has 100 bits of random entropy. Short numeric PINs are forbidden because Trystero's signaling-encryption derivation is intentionally fast and would permit cheap offline guessing.
- Domain-separated SHA-256 derivations produce distinct room and password values; the session's security is bounded by the pairing key's 100 bits, not the encoded output lengths.
- The room password encrypts session descriptions while they traverse public rendezvous relays.
- The QR key arrives in the URL fragment, is scrubbed after parsing, and must not be logged. A manually entered key remains only in runtime memory.
- No application telemetry or persistent storage is used.
- User-facing errors must not include room credentials, raw SDP, ICE candidates, stack traces, or camera content.
- Only the phone requests camera permission; audio is never requested.

## Acceptance criteria

1. A production build can be served as static files from a GitHub Pages project path.
2. The television produces a scannable QR pairing link, a readable 20-character pairing key, and visibly waits for a phone.
3. The phone accepts either the QR link or manual key, derives the matching session, and requests the user-facing camera only after user activation.
4. Pose inference occurs locally with the vendored model and runtime assets.
5. One or two detected people render on the phone preview and television without stable identity assumptions.
6. Only strictly validated landmark packets enter television rendering.
7. Stale, malformed, disconnected, permission-denied, unsupported, and initialization-failure states are explicit.
8. All camera, worker, room, and animation resources are released on stop or unmount.
9. Canonical formatting, linting, type analysis, unit/component tests, end-to-end smoke tests, dependency audit, and production build checks pass.
10. A real phone-and-television run confirms pairing, camera framing, multiperson behavior where detectable, and acceptable perceived latency.
11. The television requests fullscreen from its explicit start activation, mirrors every body-controlled layer, and supports adaptive dwell activation of all three prototype actions.

## Implementation plan

- [x] Record the product, architecture, transport, stack, packet, privacy, and testing decisions.
- [x] Bootstrap the deterministic TypeScript/Vite/Preact toolchain and static asset pipeline.
- [x] Implement strict session-link and pose-packet domain contracts.
- [x] Implement the MediaPipe worker and bounded phone inference loop.
- [x] Implement decentralized rendezvous and latest-only WebRTC pose delivery.
- [x] Implement the accessible role selection, phone controller, QR/manual-key pairing, status surfaces, and Canvas 2D skeleton renderer.
- [x] Implement trusted TV-mode entry, the shared mirrored projection, adaptive temporary pose controls, and the three prototype actions.
- [x] Add automated tests, CI, and the GitHub Pages deployment workflow.
- [x] Run all canonical validation and perform available production-browser smoke testing.
- [x] Publish the GitHub Pages artifact from the remote repository.
- [ ] Validate on the owner's real phone and television.
