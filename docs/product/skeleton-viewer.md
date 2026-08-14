---
status: Active
last_verified: 2026-08-14
scope: First vertical slice contract, acceptance criteria, and implementation plan
---

# Skeleton-viewer prototype

## Implementation state

The skeleton viewer is implemented. Publication state, automated verification evidence, and the outstanding real phone/television acceptance are tracked in [Project status](../project/status.md).

## Implementation map

| Concern | Canonical implementation |
| --- | --- |
| Role routing and page lifecycle | [`src/app.tsx`](../../src/app.tsx) and [`src/pages/`](../../src/pages/) |
| Pairing credentials and fragment contract | [`src/session/credentials.ts`](../../src/session/credentials.ts) |
| Camera scheduling and cleanup | [`src/pose/camera-pose-controller.ts`](../../src/pose/camera-pose-controller.ts) |
| MediaPipe isolation and worker protocol | [`src/pose/`](../../src/pose/) |
| Pose packet validation and ordering | [`src/domain/pose.ts`](../../src/domain/pose.ts) |
| Shared coarse-hand derivation | [`src/domain/pose-features.ts`](../../src/domain/pose-features.ts) |
| Phone-local pose diagnostics | [`src/pose/pose-diagnostics.ts`](../../src/pose/pose-diagnostics.ts) and [`src/components/pose-diagnostics-panel.tsx`](../../src/components/pose-diagnostics-panel.tsx) |
| Player-limit domain contract | [`src/domain/pose-limit.ts`](../../src/domain/pose-limit.ts) |
| Peer authentication and WebRTC actions | [`src/transport/peer-room.ts`](../../src/transport/peer-room.ts) |
| Backpressure policy | [`src/transport/latest-sender.ts`](../../src/transport/latest-sender.ts) |
| Renderer geometry and drawing | [`src/render/`](../../src/render/) and [`src/components/skeleton-canvas.tsx`](../../src/components/skeleton-canvas.tsx) |
| Television pose controls | [`src/interaction/pose-controls.ts`](../../src/interaction/pose-controls.ts) and [`src/components/tv-playfield.tsx`](../../src/components/tv-playfield.tsx) |
| Game navigation and action phases | [`src/components/tv-playfield.tsx`](../../src/components/tv-playfield.tsx) |
| Draw game | [`src/games/draw/`](../../src/games/draw/) |
| Bubbles game | [`src/games/bubbles/`](../../src/games/bubbles/) |
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
- MediaPipe Pose Landmarker Lite runs in a module worker. Every pairing session starts with a one-pose limit; the acknowledged television control can reconfigure the existing landmarker to one or two poses without restarting the camera.
- The camera requests an ideal and maximum 30 FPS. Every eligible presented frame starts inference when no estimate or reconfiguration is active; there is no lower elapsed-time sampling gate.
- The phone previews its camera and latest local skeleton, reports the active pose limit, and sends pose packets only while a peer is connected.
- While tracking, the phone offers a collapsed diagnostics panel with bounded local camera/submission/completion rates, processing-age median/p95, and motion-inclusive one-player coarse-hand spread. No diagnostic coordinates or aggregates leave the phone.
- Stopping and restarting tracking within one connected pairing session retains the last acknowledged limit. Disconnecting or creating a new pairing session resets it to one.
- Stopping or leaving closes the worker, camera tracks, room, and peer connection.

### Pairing and transport

- Both peers derive the same room and password from the ephemeral pairing key and use them through Trystero's public Nostr rendezvous network.
- Every new TV session creates a fresh key. The television stops displaying the key and QR after a phone connects.
- WebRTC DataChannels carry application data directly after discovery.
- Pose packets travel phone-to-television. The only reverse application command is a strict absolute `{ poseLimit: 1 | 2 }` request; the television changes its mode only after the phone returns the matching applied limit.
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
- The television applies one shared horizontal mirror projection to its skeleton, Draw board/input, Bubbles arena/input, cursors, adaptive button layout, and hit testing. The phone preview is not changed by this television-only rule.
- Landmarks below the visibility threshold are not connected or drawn.
- Per-frame colors use one fixed teal/rose palette to distinguish simultaneous detections but never imply stable identity.
- A packet older than one second in television receive time is stale and must not remain presented as live.
- Draw and Bubbles consume the same validated pose-domain boundary and own separate Canvas 2D sessions/renderers without coupling the application shell to a universal game engine.
- Temporal processing remains consumer-specific: Draw path smoothing, two-hand grip evidence, Bubbles swept collision, button controls, and skeleton presentation do not mutate or replace the canonical packet.

## Body-control contract

- A Main Menu or Games control claim is available only when the complete reserved menu row can fit above the highest usable face landmark inside the projected camera viewport. Draw and the actionable Bubbles phases instead require their complete compact left column to fit inside the projected frame. Each view has exactly one placement and no fallback.
- Buttons appear only after a temporary controller claim. Before that, an eligible single person is prompted to raise either hand with the whole hand visible; with multiple visible people, one person is prompted to raise both hands and keep one whole hand visible.
- A single-person claim requires one wrist above its elbow for 300 ms. A multiperson claim requires both wrists above the shoulders for 500 ms.
- The claim selects a controlling side. Raising and below-hips release use that side's wrist, while the direct mirrored pointer is the arithmetic center of its wrist, pinky, index, and thumb landmarks.
- All four coarse-hand landmarks must be usable. A missing point hides the pointer and resets dwell instead of falling back to the wrist; a sustained loss releases the lease through the one-second loss bound.
- The television uses short-lived nearest-torso continuity only to survive pose-array reordering. It creates no stable skeleton or player identifier.
- Main Menu and Games use a row centered on the shoulder midpoint, placed with a small gap above the visibly drawn head, constrained wholly within the projected camera viewport, and frozen until release. Draw uses a compact four-button column; Bubbles Ready and Finished use compact two-button columns. Each column sits inside the projected frame's left edge, centers around the leased torso, and freezes for the lease.
- A new lease is body-unarmed. The coarse hand must be observed outside every target and its hover margin once before reaching into a button can begin dwell; semantic remote and accessibility activation remain available throughout.
- A button activates after a 900 ms dwell, activates only once until the pointer leaves, and shows progress while dwelling.
- Control releases after 600 ms with the selected wrist below the hips, one second without the controlling pose/hand, 600 ms materially displaced from the frozen layout, 15 seconds without coarse-hand activity, or a viewport change.
- Main Menu buttons toggle a fixed background theme, request the opposite one-/two-player limit, or open Games. Games contains Draw, Bubbles, and Return. Draw contains Pencil/Eraser, Color, Clear, and Exit. Bubbles exposes Start/Exit before a round, no actions during its countdown or active round, and Play Again/Exit after results.
- While a player-limit request is pending, all three actions are disabled. Failure keeps the last acknowledged mode; success updates the dynamic **Players: 1** or **Players: 2** label.
- Buttons remain semantic and remotely clickable. Body interactions are the canonical in-session path; the semantic path preserves television-remote and accessibility operation.
- Draw receives both complete coarse hands plus aspect-corrected shoulder span from the leased pose. Separation at or below `0.75 ×` shoulder span immediately activates the selected main-hand tool; it remains active until separation reaches at least `1.25 ×` shoulder span or an existing safety boundary resets the interaction.
- Starting Bubbles suspends control activation and uses both complete coarse hands from every currently usable pose independently of the lease. Finished controls are restored in a neutral-unarmed state.

Mirroring and lease rationale are governed by [ADR-0005](../decisions/0005-mirrored-tv-pose-controls.md). Player-limit semantics and acknowledgement are governed by [ADR-0006](../decisions/0006-session-player-limit-control.md). Above-head menu placement, coarse-hand pointing, and neutral arming are governed by [ADR-0008](../decisions/0008-above-head-coarse-hand-controls.md). Camera cadence is governed by [ADR-0009](../decisions/0009-camera-paced-inference.md). Navigation and the game boundary originate in [ADR-0010](../decisions/0010-menu-and-draw-game.md); current Draw behavior is governed by [ADR-0012](../decisions/0012-two-hand-draw-grip.md) and the [Draw contract](draw-game.md), while Bubbles is governed by [ADR-0013](../decisions/0013-identity-independent-bubbles-game.md) and the [Bubbles contract](bubbles-game.md). Consumer-specific stability and measurement remain governed by [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md) and [Pose quality](../engineering/pose-quality.md).

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
- Pose diagnostics retain only a bounded phone-memory window and expose aggregate rates, age, and pixel spread; they do not log, persist, or transmit coordinates.
- User-facing errors must not include room credentials, raw SDP, ICE candidates, stack traces, or camera content.
- Only the phone requests camera permission; audio is never requested.

## Acceptance criteria

1. A production build can be served as static files from a GitHub Pages project path.
2. The television produces a scannable QR pairing link, a readable 20-character pairing key, and visibly waits for a phone.
3. The phone accepts either the QR link or manual key, derives the matching session, and requests the user-facing camera only after user activation.
4. Pose inference occurs locally with the vendored model and runtime assets.
5. New sessions initialize one-person inference; the television can switch to two-person inference and back only through an exact phone acknowledgement, without restarting the camera.
6. Only strictly validated landmark packets enter television rendering.
7. Stale, malformed, disconnected, permission-denied, unsupported, and initialization-failure states are explicit.
8. All camera, worker, room, and animation resources are released on stop or unmount.
9. Canonical formatting, linting, type analysis, unit/component tests, end-to-end smoke tests, dependency audit, and production build checks pass.
10. A real phone-and-television run confirms pairing, camera framing, multiperson behavior where detectable, and acceptable perceived latency.
11. The television requests fullscreen from its explicit start activation, mirrors every body-controlled layer, requires reachable space above the visible head for menu rows, places Draw/Bubbles columns inside the reachable left edge, points with complete coarse hands without wrist fallback, neutral-arms each actionable view, and supports the Main Menu/Games/Draw/Bubbles hierarchy.
12. Camera-paced single-flight inference, Draw presentation, two-hand tool engagement, path breaking, color, clearing, navigation, and ephemeral retention satisfy [Draw game](draw-game.md).
13. Bubbles readiness, exact countdown/round timing, both-hand collision, identity-independent one-/two-player scoring, in-bounds procedural movement, results, and transient cleanup satisfy [Bubbles game](bubbles-game.md).

## Implementation plan

- [x] Record the product, architecture, transport, stack, packet, privacy, and testing decisions.
- [x] Bootstrap the deterministic TypeScript/Vite/Preact toolchain and static asset pipeline.
- [x] Implement strict session-link and pose-packet domain contracts.
- [x] Implement the MediaPipe worker and bounded phone inference loop.
- [x] Implement decentralized rendezvous and latest-only WebRTC pose delivery.
- [x] Implement the accessible role selection, phone controller, QR/manual-key pairing, status surfaces, and Canvas 2D skeleton renderer.
- [x] Implement trusted TV-mode entry, the shared mirrored projection, adaptive temporary pose controls, and the three prototype actions.
- [x] Default to one-player inference and implement an acknowledged in-place one-/two-player switch from the television control row.
- [x] Move the frozen row above the visible head, require overhead framing, replace direct wrist pointing with the coarse-hand center, and add neutral post-claim arming.
- [x] Remove the fixed 15 Hz gate while retaining a 30 FPS camera ceiling and single-flight/latest-only backpressure.
- [x] Replace Circles with Main Menu/Games navigation and implement the transient normalized two-hand Draw game.
- [x] Add bounded phone-local pose diagnostics without globally smoothing pose data.
- [x] Replace stationary Draw engagement with immediate body-relative two-hand grip hysteresis, one selected main-hand tool, and the compact left toolbar.
- [x] Add identity-independent one-/two-player Bubbles with exact timed rounds, procedural radius-safe motion, swept both-hand collision, scores, results, and control suspension.
- [x] Add automated tests, CI, and the GitHub Pages deployment workflow.
- [x] Run all canonical validation and perform available production-browser smoke testing.
- [x] Publish the original skeleton-viewer artifact from the remote repository; current publication state remains in [Project status](../project/status.md).
- [ ] Validate on the owner's real phone and television.
