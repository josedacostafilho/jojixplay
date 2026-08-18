---
status: Active
last_verified: 2026-08-18
scope: All-in-one phone user journey, runtime boundaries, privacy, lifecycle, and implementation plan
---

# Play on this phone

## Outcome

**Play on this phone** runs the complete JojixPlay experience on one phone: the selfie camera, orientation normalization, MediaPipe inference, body controls, avatar, and games all execute in the same static page. The user may play on the phone screen or mirror that final application screen to a television through operating-system or wired-display facilities.

This mode is the performance-safe topology when a television browser cannot render games adequately. It is not an automatic network fallback and it does not weaken or duplicate any game. [ADR-0018](../decisions/0018-all-in-one-phone-play.md) governs the architecture.

## User journey

1. Open JojixPlay and choose **Play on this phone**.
2. Prop up the phone so its user-facing camera can see the intended players' full bodies.
3. Optionally begin operating-system screen mirroring or connect a wired display.
4. Press **Start local play** once to start required sound, request camera permission, and request best-effort fullscreen/wake behavior.
5. Use the same mirrored body-controlled Main Menu and Games surfaces as television mode.
6. Press the persistent semantic **Stop local play** action when finished; leaving or reloading the page performs the same resource cleanup.

No QR code, pairing key, second browser, peer connection, account, or application-owned cast control exists in this journey.

## Runtime flow

```text
trusted Start local play activation
        ├── one native AudioContext → phone/mirrored output
        ↓
front camera → canonical orientation normalization → MediaPipe worker
        ↓ validated raw PosePacket, direct in-memory callback
shared mirrored BodyPlayfield
        ├── Main Menu / Games / Draw / Bubbles: Canvas 2D
        └── Racing: one lazy forced-Canvas Phaser runtime
        ↓
phone display → optional OS/wired screen mirroring outside JojixPlay
```

- The camera lifecycle and worker are the same canonical implementation used by the paired phone controller.
- The playfield and every game are the same canonical implementations used by television display mode.
- There is no serialization, freshness queue, Nostr rendezvous, WebSocket, WebRTC, or loopback peer between the two boundaries.
- Packets remain raw, upright, unsmoothed, and unmirrored until the shared playfield applies its horizontal presentation mirror.
- The last packet is withheld after the established one-second freshness bound so a suspended camera cannot leave stale body input active.

## Setup and presentation

- The setup screen clearly says that camera pixels stay on the device and that casting is user-managed.
- The capture source is an internal muted, inline-playing video element required by browser camera-frame APIs. It is visually clipped and transparent, has no accessible preview label, and must never be styled into view.
- Local play renders no camera preview. Before a pose is available, textual status asks the user to step back and fit their body in frame; afterward, the avatar and game-specific feedback are the framing signal.
- The active screen reserves a compact top safety bar for status and **Stop local play**. The remaining bounded stage belongs entirely to `BodyPlayfield`; the stop action does not cover buttons, scores, timers, messages, or the Racing canvas.
- Best-effort fullscreen is requested from the start activation. Failure does not block play.
- A best-effort Screen Wake Lock is held while local play is active, released when hidden or stopped, and reacquired when the active page becomes visible if the platform permits it. Unsupported or rejected wake lock requests do not block play.

## Controls, player count, and orientation

- A new local-play run starts with one-pose inference.
- The **Players** action invokes `CameraPoseController.setPoseLimit` directly. The displayed player count changes only after successful MediaPipe reconfiguration; concurrent requests are rejected.
- Game layout gates invoke `CameraPoseController.requestCameraLayout` directly. The gate stays active until the requested canonical layout is committed; there is no optimistic acknowledgement.
- Portrait/landscape support is unchanged: Main Menu, Settings, Games, Draw, and one-player Bubbles/Racing accept either layout; two-player Bubbles/Racing requires landscape.
- The playfield uses the same horizontal mirror, coarse-hand claim, neutral arming, dwell, Draw grip, Bubbles collision, and Racing lean contracts as television mode.
- Semantic buttons remain touch- and keyboard-operable for setup, safety, and accessibility. No local-only gesture or alternate control system is introduced.

## Capability and failure behavior

Local play requires the union of phone inference and playfield rendering capabilities: secure-context camera access, Screen Orientation type/angle, WebAssembly, WebGL 2 for MediaPipe, module workers, `createImageBitmap`, `requestVideoFrameCallback`, ResizeObserver, Canvas 2D, and standard Web Audio. It does not require Web Crypto, WebSockets, or WebRTC.

- Missing required capabilities produce one blocking, actionable unsupported-device panel.
- Audio startup failure, camera denial, camera absence/busy state, orientation failure, or model failure returns to a retryable setup state with the owned audio/camera/worker/wake resources stopped.
- A failed player-limit change leaves the last successfully applied player count visible and stops uncertain tracking through the existing controller contract.
- A camera-layout timeout leaves the game gate visible and reports the failure without fabricating a matching layout.
- Page unmount, explicit stop, and navigation release the audio context/voices/listener, camera tracks, frame callback, worker, pending layout request, wake lock, and local play state. Racing teardown remains owned by `BodyPlayfield`.

## Privacy and data

- Camera pixels stay inside the camera element, `ImageBitmap`, and MediaPipe worker on the same phone. They are never intentionally drawn into the local-play presentation.
- No pose packet, diagnostic, coordinate, score, artwork, camera frame, or game state is sent, logged, or persisted by local play.
- If the user mirrors the screen, the external system receives the rendered JojixPlay screen according to that system's own behavior. Because there is no preview, JojixPlay's screen contains the avatar/games rather than raw camera video.
- Output-only sound starts from the explicit activation and follows external mirroring only according to the operating system. JojixPlay never requests microphone permission, selects an output device, transmits audio, or records it.

## Implementation plan

- [x] Add strict application-mode routing for television display, paired phone controller, and local play; delete the former `role` route.
- [x] Rename the television-specific playfield component, CSS, tests, and documentation to the shared `BodyPlayfield` contract.
- [x] Extract one reusable camera-controller lifecycle for paired and local pages without changing `CameraPoseController`, MediaPipe, or `PosePacket` semantics.
- [x] Add mode-specific capability checks so local play does not depend on peer-network APIs.
- [x] Implement the local setup, trusted start, hidden capture source, direct packet flow, freshness gate, status/safety bar, player/layout commands, and deterministic cleanup.
- [x] Add best-effort fullscreen and Screen Wake Lock ownership without making optional APIs blocking requirements.
- [x] Add unit, component, production-browser, routing-hard-cutover, privacy, direct-flow, reconfiguration, and cleanup coverage.
- [x] Reconcile the architecture, product, status, testing, milestone, backlog, and agent sources of truth and run the complete canonical validation suite.
- [x] Integrate the one rendering-host audio runtime into trusted startup, failure cleanup, BodyPlayfield, Stop, and unmount without adding a peer path.

## Acceptance criteria

1. The landing page offers television display, paired phone controller, and **Play on this phone** as three distinct choices.
2. Only the exact `mode=tv`, `mode=phone`, and `mode=local` routes are accepted; the removed `role` route is not interpreted.
3. Local play asks for camera access and starts its one audio context only after **Start local play**, then uses the user-facing camera through the existing 30 FPS-ceiling, single-flight inference path.
4. No pairing key, QR code, peer room, WebSocket/WebRTC requirement, sender, or loopback transport is created in local mode.
5. The first validated local packet reaches the shared mirrored playfield directly, becomes stale after one second without a replacement, and never mutates the packet.
6. No visible or accessibility-exposed camera preview exists; the internal capture source remains visually hidden throughout setup, play, resize, and orientation changes.
7. Player-limit and camera-layout state changes only after the existing camera controller successfully applies the requested absolute value.
8. Local play reaches the same Draw, Bubbles, and lazy forced-Canvas Racing implementations with the same portrait/landscape and one-/two-player policies.
9. Fullscreen and wake lock are best-effort; rejection or absence does not block camera/game startup. Required sound or camera failure blocks the session and cleans partial ownership; stop/unmount releases every acquired resource.
10. Automated production-browser coverage reaches a real first MediaPipe packet with fake camera input after trusted audio startup, and real-device acceptance records sustained phone performance, sound, thermals, framing, orientation, and external-mirroring latency.
