---
status: Active
last_verified: 2026-08-18
scope: First vertical slice contract, acceptance criteria, and implementation plan
---

# Phone-to-television body-control prototype

## Implementation state

The phone-to-television vertical slice is implemented. Its original stick-skeleton proof has been hard-cut to the procedural body avatar in [Avatar renderer](avatar-renderer.md). This document owns the paired-device topology; the direct all-in-one topology is specified separately in [Play on this phone](local-play.md). Publication state, automated verification evidence, and outstanding real-device acceptance are tracked in [Project status](../project/status.md).

## Implementation map

| Concern | Canonical implementation |
| --- | --- |
| Strict application-mode routing and page lifecycle | [`src/platform/application-mode.ts`](../../src/platform/application-mode.ts), [`src/app.tsx`](../../src/app.tsx), and [`src/pages/`](../../src/pages/) |
| Pairing credentials and fragment contract | [`src/session/credentials.ts`](../../src/session/credentials.ts) |
| Shared camera lifecycle, scheduling, and cleanup | [`src/pose/use-camera-pose.ts`](../../src/pose/use-camera-pose.ts) and [`src/pose/camera-pose-controller.ts`](../../src/pose/camera-pose-controller.ts) |
| Camera layout, rotation, and epoch contract | [`src/domain/camera.ts`](../../src/domain/camera.ts) and [Camera orientation](camera-orientation.md) |
| MediaPipe isolation and worker protocol | [`src/pose/`](../../src/pose/) |
| Pose packet validation and ordering | [`src/domain/pose.ts`](../../src/domain/pose.ts) |
| Shared coarse-hand derivation | [`src/domain/pose-features.ts`](../../src/domain/pose-features.ts) |
| Phone-local pose diagnostics | [`src/pose/pose-diagnostics.ts`](../../src/pose/pose-diagnostics.ts) and [`src/components/pose-diagnostics-panel.tsx`](../../src/components/pose-diagnostics-panel.tsx) |
| Player-limit domain contract | [`src/domain/pose-limit.ts`](../../src/domain/pose-limit.ts) |
| Peer authentication and WebRTC actions | [`src/transport/peer-room.ts`](../../src/transport/peer-room.ts) |
| Backpressure policy | [`src/transport/latest-sender.ts`](../../src/transport/latest-sender.ts) |
| Avatar presentation and drawing | [`src/render/avatar-presentation.ts`](../../src/render/avatar-presentation.ts), [`src/render/avatar.ts`](../../src/render/avatar.ts), and [`src/components/avatar-canvas.tsx`](../../src/components/avatar-canvas.tsx) |
| Shared mirrored pose controls | [`src/interaction/pose-controls.ts`](../../src/interaction/pose-controls.ts) and [`src/components/body-playfield.tsx`](../../src/components/body-playfield.tsx) |
| Game navigation and action phases | [`src/components/body-playfield.tsx`](../../src/components/body-playfield.tsx) |
| Game camera-layout policies | [`src/games/catalog.ts`](../../src/games/catalog.ts) |
| Draw game | [`src/games/draw/`](../../src/games/draw/) |
| Bubbles game | [`src/games/bubbles/`](../../src/games/bubbles/) |
| Racing game | [`src/games/racing/`](../../src/games/racing/) and [Racing game](racing-game.md) |
| Rendering-host sound | [`src/audio/audio-engine.ts`](../../src/audio/audio-engine.ts) and [Application audio](audio.md) |
| Production deployment | [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) |

## Selected behavior

### Television

- The television selects exact application mode `mode=tv` from the static application.
- It waits for one trusted television-side **Start TV mode** activation, starts the required native audio output, requests fullscreen on a best-effort basis, and only then creates and joins a pairing session.
- It creates a cryptographically random 20-character Crockford base32 pairing key with 100 bits of entropy and displays it in five readable groups.
- It derives a 128-bit room value and 192-bit password representation from that key with purpose-separated SHA-256 inputs, then joins through Trystero's Nostr strategy.
- It displays both a QR link carrying the key in its URL fragment and the same key for manual phone entry.
- It accepts one phone peer, validates every received packet, and renders the newest valid packet on a Canvas 2D surface.
- It mirrors the contained pose presentation horizontally without changing anatomical landmark indices or network data.
- It derives menu placement from the validated canonical frame layout, gates an incompatible game before entry, and requests an absolute phone layout through a strict acknowledgement.
- It shows explicit waiting, connected, stale-signal, disconnected, unsupported, and fatal-error states.

### Phone

- The paired controller selects exact application mode `mode=phone` and obtains the pairing key from the QR fragment or a validated manual-entry form. It immediately removes a QR fragment from the visible history entry; fragments are not sent to the static host in HTTP requests.
- Manual entry is case-insensitive, groups the key for readability, and normalizes the ambiguous Crockford characters O, I, and L. Both entry methods feed the same key derivation and session path.
- Camera capture begins only after a user action and explicit browser permission.
- Camera capture prefers the user-facing (selfie) camera.
- MediaPipe Pose Landmarker Lite runs in a module worker. Every pairing session starts with a one-pose limit; the acknowledged television control can reconfigure the existing landmarker to one or two poses without restarting the camera.
- The phone requires validated Screen Orientation metadata, compares it with each actual camera bitmap, and supplies MediaPipe the necessary clockwise quarter-turn. MediaPipe returns unrotated input-image coordinates, which the worker transforms exactly once into the upright canonical frame.
- Tracking can start in portrait or landscape. The stabilization and invalid-metadata thresholds in [Camera orientation](camera-orientation.md) prevent transitional frames from entering inference; a committed change increments the frame epoch and resets MediaPipe's temporal tracker without restarting the camera or pairing session.
- The camera requests an ideal and maximum 30 FPS. Every eligible presented frame starts inference when no estimate or reconfiguration is active; there is no lower elapsed-time sampling gate.
- The phone previews camera pixels and its latest local body avatar in the same canonical aspect and orientation, reports the active pose limit and layout, displays requested rotation guidance, and sends pose packets only while a peer is connected.
- While tracking, the phone offers a collapsed diagnostics panel with bounded local orientation/source/rotation/epoch state, camera/submission/completion rates, processing-age median/p95, and motion-inclusive one-player coarse-hand spread. No diagnostic coordinates or aggregates leave the phone.
- Stopping and restarting tracking within one connected pairing session retains the last acknowledged limit. Disconnecting or creating a new pairing session resets it to one.
- Stopping or leaving closes the worker, camera tracks, room, and peer connection.

### Pairing and transport

- Both peers derive the same room and password from the ephemeral pairing key and use them through Trystero's public Nostr rendezvous network.
- Every new TV session creates a fresh key. The television stops displaying the key and QR after a phone connects.
- WebRTC DataChannels carry application data directly after discovery.
- Pose packets travel phone-to-television. Reverse application commands are strict absolute `{ poseLimit: 1 | 2 }` and `{ cameraLayout: "portrait" | "landscape" }` requests. The television treats either as applied only after the phone returns the exact matching acknowledgement.
- The orientation hard cut uses peer protocol `jojixplay-skeleton/3`; older peers and frame shapes are incompatible and fail closed.
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
│   ├── height: positive integer, at most 16,384
│   ├── layout: portrait | landscape, consistent with width and height
│   └── epoch: non-negative integer identifying the committed camera basis
└── poses: array with 0..2 items
    └── landmarks: exactly 33 items
        ├── x: finite normalized image coordinate
        ├── y: finite normalized image coordinate
        ├── z: finite relative depth
        └── visibility: finite value from 0 through 1
```

Coordinates are unsmoothed and unmirrored in the upright canonical camera basis: `x` increases visually rightward and `y` downward. Source orientation and rotation are phone-local and are not serialized. No schema version, person ID, camera image, user identifier, or arbitrary extension fields are permitted. Schema changes are hard cutovers. Receivers reject malformed packets and ignore non-increasing sequence numbers.

The sender retains at most one pending packet while an earlier send is in progress. A newer packet replaces the pending packet so transport backpressure cannot create an unbounded stale-frame queue.

## Rendering contract

- Canvas 2D is the graphics baseline. The avatar, Draw, and Bubbles own focused direct Canvas renderers; Racing owns one lazy Phaser runtime forced to its Canvas renderer.
- Each avatar canvas owns an isolated presentation session that consumes only validated `PosePacket` values and has no dependency on MediaPipe or Trystero.
- The actual canonical camera aspect ratio is preserved with contain-style letterboxing. The application neither forces `4:3` nor treats aspect ratio as a field-of-view proxy.
- `BodyPlayfield` applies one shared horizontal mirror projection to its avatar, Draw board/input, Bubbles arena/input, Racing pose steering, cursors, adaptive button layout, and hit testing. The paired phone preview remains unmirrored.
- The avatar synthesizes a faceless oval head, curved torso, tapered rounded limbs/joints, complete coarse hands, and complete feet. Missing required geometry is omitted; a pose without all shoulders and hips is not drawn.
- Per-frame materials use one fixed teal/rose palette to distinguish simultaneous detections but never imply stable identity.
- Continuous one-pose display copies use the bounded presentation-only landmark, segment-length, and near-side stabilization in [Avatar renderer](avatar-renderer.md). Zero or multiple poses reset that history; multi-pose presentation uses only current-packet geometry.
- A packet older than one second in television receive time is stale and must not remain presented as live.
- Draw, Bubbles, and Racing consume the same validated pose-domain boundary. Draw/Bubbles own focused Canvas sessions; Racing lazy-loads one Phaser Canvas adapter without coupling the shell or other games to the engine.
- Temporal processing remains consumer-specific: Draw path smoothing, two-hand grip evidence, Bubbles swept collision, Racing analog torso response, button controls, and avatar presentation do not mutate or replace the canonical packet or consume one another's derived values.

## Body-control contract

- In portrait, a Main Menu control claim is available only when its complete reserved row can fit above the highest usable face landmark inside the projected camera viewport. Main Menu uses the compact left column in landscape. Settings, Games, Draw, and actionable Bubbles/Racing phases use the compact left column in either layout. Each layout/view pair has exactly one placement and no fallback.
- Buttons appear only after a temporary controller claim. Before that, an eligible single person is prompted to raise either hand with the whole hand visible; with multiple visible people, one person is prompted to raise both hands and keep one whole hand visible.
- A single-person claim requires one wrist above its elbow for 300 ms. A multiperson claim requires both wrists above the shoulders for 500 ms.
- The claim selects a controlling side. Raising and below-hips release use that side's wrist, while the direct mirrored pointer is the arithmetic center of its wrist, pinky, index, and thumb landmarks.
- All four coarse-hand landmarks must be usable. A missing point hides the pointer and resets dwell instead of falling back to the wrist; a sustained loss releases the lease through the one-second loss bound.
- The television uses short-lived nearest-torso continuity only to survive pose-array reordering. It creates no stable person or player identifier.
- Portrait Main Menu uses a row centered on the shoulder midpoint, placed with a small gap above the highest usable face landmark, constrained wholly within the projected camera viewport, and frozen until release. Landscape Main Menu plus Settings, Games, Draw, Bubbles Ready/Finished, and Racing Ready/Paused/Finished use compact columns inside the projected frame's left edge, centered around the leased torso and frozen for the lease.
- A new lease is body-unarmed. The coarse hand must be observed outside every target and its hover margin once before reaching into a button can begin dwell; semantic remote and accessibility activation remain available throughout.
- A button activates after a 900 ms dwell, activates only once until the pointer leaves, and shows progress while dwelling.
- Control releases after 600 ms with the selected wrist below the hips, one second without the controlling pose/hand, 600 ms materially displaced from the frozen layout, 15 seconds without coarse-hand activity, or a viewport change.
- Main Menu contains Games, the one-/two-player request, and Settings. Settings contains the session-local Sound toggle, Background theme, and Return. Games contains Draw, Bubbles, Racing, and Return. Draw contains Pencil/Eraser, Color, Clear, and Exit. Bubbles exposes Start/Exit before a round, no actions during its countdown or active round, and Play Again/Exit after results. Racing exposes Start/Exit while Ready, no actions during calibration or driving, Resume/Recenter/Restart/Exit while Paused, and Play Again/Exit after the finish.
- Actionable Bubbles and Racing message panels remain near the top center and below the control target layer. Informational cards never cover the visible button surface; central countdown feedback appears only while actions are suspended.
- While a player-limit or camera-layout request is pending, semantic and body actions cannot activate. A player-limit failure keeps the last acknowledged mode; success updates the dynamic **Players: 1** or **Players: 2** label.
- Buttons remain semantic and remotely clickable. Body interactions are the canonical in-session path; the semantic path preserves television-remote and accessibility operation.
- Draw receives both complete coarse hands plus aspect-corrected shoulder span from the leased pose. Separation at or below `0.75 ×` shoulder span immediately activates the selected main-hand tool; it remains active until separation reaches at least `1.25 ×` shoulder span or an existing safety boundary resets the interaction.
- Starting Bubbles suspends control activation and uses both complete coarse hands from every currently usable pose independently of the lease. Finished controls are restored in a neutral-unarmed state.
- Starting Racing suspends control activation, calibrates the aspect-corrected shoulder/hip torso angle for three seconds of fresh input, then maps lean through a symmetric `3°` dead zone and `15°` full-scale smoothstep target with an `80 ms` response. Automatic throttle runs through a deterministic `60 Hz` fixed-step simulation on the denser authored course, and every two-player viewport projects the other car while it remains in front of that chase camera. Hands affect Racing only through a one-second two-hands-overhead pause hold. The procedural avatar and ordinary pose cursor remain absent while Racing.
- Draw and one-player Bubbles/Racing may enter under either camera layout; two-player Bubbles/Racing mounts only after landscape is acknowledged and a matching packet arrives. An active game locks its entering layout. Mismatched packets are withheld, controls release, Draw cancels grip/path while retaining art, and Bubbles/Racing freeze their full clocks and simulation until the captured layout returns with fresh temporal input.

Mirroring and lease rationale are governed by [ADR-0005](../decisions/0005-mirrored-tv-pose-controls.md). Player-limit semantics and acknowledgement are governed by [ADR-0006](../decisions/0006-session-player-limit-control.md). Above-head portrait placement, coarse-hand pointing, and neutral arming originate in [ADR-0008](../decisions/0008-above-head-coarse-hand-controls.md). Camera cadence is governed by [ADR-0009](../decisions/0009-camera-paced-inference.md). Navigation and the game boundary originate in [ADR-0010](../decisions/0010-menu-and-draw-game.md); current Draw behavior is governed by [ADR-0012](../decisions/0012-two-hand-draw-grip.md) and the [Draw contract](draw-game.md), Bubbles by [ADR-0013](../decisions/0013-identity-independent-bubbles-game.md) and the [Bubbles contract](bubbles-game.md), and Racing by [ADR-0016](../decisions/0016-phaser-canvas-racing.md), [ADR-0019](../decisions/0019-analog-torso-racing.md), and the [Racing contract](racing-game.md). Unsmoothed-pose ownership remains governed by [ADR-0011](../decisions/0011-consumer-specific-pose-stability.md), while current visible presentation is governed by [ADR-0014](../decisions/0014-procedural-body-avatar.md), the [Avatar renderer contract](avatar-renderer.md), and [Pose quality](../engineering/pose-quality.md). Canonical rotation, frame epochs, layout requests, and game policies are governed by [ADR-0015](../decisions/0015-canonical-camera-orientation.md) and [Camera orientation](camera-orientation.md). Rendering-host sound is governed by [ADR-0020](../decisions/0020-app-owned-procedural-audio.md) and [Application audio](audio.md).

## Capability baseline

The paired phone must support secure-context camera capture, the Screen Orientation type/angle API, WebAssembly, WebGL 2, module workers, `createImageBitmap`, `requestVideoFrameCallback`, Web Crypto, WebSockets, WebRTC DataChannels, ResizeObserver, and Canvas 2D. The television must support ES modules, Web Crypto, WebSockets, WebRTC DataChannels, ResizeObserver, Canvas 2D, and standard Web Audio. Local play requires the phone/camera baseline, Canvas 2D, ResizeObserver, and standard Web Audio but not WebSocket or WebRTC APIs. WebGL 2 is part of the phone's MediaPipe baseline; avatar and game presentation intentionally require only Canvas 2D.

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
- Only a camera-running phone requests camera permission. No mode requests microphone permission; the television/local rendering host starts output-only Web Audio from its explicit activation.

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
10. A real phone-and-television run confirms pairing, portrait and both landscape directions, camera framing, multiperson behavior where detectable, horizontal television mirroring, and acceptable perceived latency.
11. The television starts sound and requests fullscreen from its explicit start activation, mirrors every body-controlled layer, uses a portrait overhead row only for Main Menu and compact left columns for Settings, Games, and actionable games, points with complete coarse hands without wrist fallback, neutral-arms each actionable view, and supports the Main Menu/Settings/Games/Draw/Bubbles/Racing hierarchy.
12. Camera-paced single-flight inference, Draw presentation, two-hand tool engagement, path breaking, color, clearing, navigation, and ephemeral retention satisfy [Draw game](draw-game.md).
13. Bubbles readiness, exact countdown/round timing, both-hand collision, identity-independent one-/two-player scoring, in-bounds procedural movement, results, and transient cleanup satisfy [Bubbles game](bubbles-game.md).
14. Phone and television render only the procedural body avatar, apply the exact per-surface appearance profiles, keep its stabilization isolated from interaction, and satisfy [Avatar renderer](avatar-renderer.md).
15. Strict orientation normalization, packet epochs, diagnostics, absolute layout acknowledgement, game policies, active-game locking, and pause/resume behavior satisfy [Camera orientation](camera-orientation.md).
16. Racing torso-neutral calibration, analog lean mapping/response, denser course, opponent projection, automatic throttle, continuous near-road projection, one-/two-player results, lazy forced-Canvas runtime, pause/recovery, and teardown satisfy [Racing game](racing-game.md).
17. Trusted startup, Main Menu Settings, bounded procedural cues/voices, mute, page suspension, and cleanup satisfy [Application audio](audio.md), while the paired camera phone remains silent.

## Implementation plan

- [x] Record the product, architecture, transport, stack, packet, privacy, and testing decisions.
- [x] Bootstrap the deterministic TypeScript/Vite/Preact toolchain and static asset pipeline.
- [x] Implement strict session-link and pose-packet domain contracts.
- [x] Implement the MediaPipe worker and bounded phone inference loop.
- [x] Implement decentralized rendezvous and latest-only WebRTC pose delivery.
- [x] Implement accessible application-mode selection, paired phone controller, QR/manual-key pairing, status surfaces, and the initial Canvas pose renderer.
- [x] Implement trusted TV-mode entry, the shared mirrored projection, adaptive temporary pose controls, and the three prototype actions.
- [x] Default to one-player inference and implement an acknowledged in-place one-/two-player switch from the television control row.
- [x] Move the frozen row above the visible head, require overhead framing, replace direct wrist pointing with the coarse-hand center, and add neutral post-claim arming.
- [x] Remove the fixed 15 Hz gate while retaining a 30 FPS camera ceiling and single-flight/latest-only backpressure.
- [x] Replace Circles with Main Menu/Games navigation and implement the transient normalized two-hand Draw game.
- [x] Add bounded phone-local pose diagnostics without globally smoothing pose data.
- [x] Replace stationary Draw engagement with immediate body-relative two-hand grip hysteresis, one selected main-hand tool, and the compact left toolbar.
- [x] Add identity-independent one-/two-player Bubbles with exact timed rounds, procedural radius-safe motion, swept both-hand collision, scores, results, and control suspension.
- [x] Hard-cut the stick renderer to one faceless procedural body avatar with isolated one-player presentation stabilization and explicit menu/Draw/Bubbles/phone profiles.
- [x] Hard-cut orientation-implicit packets and fixed menu placement to canonical portrait/landscape frames, epochs, strict layout requests, orientation-aware game policies, and active-game safety.
- [x] Add lazy forced-Canvas Phaser Racing with pure input/simulation/projection modules, calibrated analog torso steering, a denser deterministic course, per-viewport opponent projection, automatic throttle, continuous near-road coverage, solo timing, landscape split-screen competition, pause controls, and complete lifecycle cleanup.
- [x] Add one rendering-host procedural Web Audio runtime, trusted TV/local startup, Settings-owned sound control, per-game cues/voices, and complete cleanup while keeping the paired phone silent.
- [x] Add automated tests, CI, and the GitHub Pages deployment workflow.
- [x] Run all canonical validation and perform available production-browser smoke testing.
- [x] Publish the original skeleton-viewer artifact from the remote repository; current publication state remains in [Project status](../project/status.md).
- [ ] Validate on the owner's real phone and television.
