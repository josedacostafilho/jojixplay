---
status: Accepted
last_verified: 2026-08-17
scope: All-in-one phone execution, shared playfield ownership, and optional immersive browser behavior
---

# ADR-0018: Run an all-in-one play mode directly on the phone

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** Project owner and maintainers
- **Supersedes:** The two-role-only application-shell scope in ADR-0002 and the television-only game-runtime scope in ADR-0003
- **Superseded by:** None

## Context

The paired phone-to-television path keeps camera and MediaPipe work off the display, but target television hardware can still be too weak to render the games smoothly. Modern phones are often substantially faster. A user can already mirror or cable a phone's final screen to a television through operating-system or hardware facilities, so JojixPlay needs a self-contained mode that performs inference and game rendering on the phone without adding a backend or streaming camera pixels.

The existing game shell, renderers, controls, camera normalization, and `PosePacket` boundary are useful in either topology. Implementing a loopback peer, a second game implementation, a reduced-quality game path, or an application-owned casting protocol would add complexity without solving a current requirement. The user also explicitly rejected a visible camera preview in this mode.

## Decision

JojixPlay has three strict application modes: television display, paired phone controller, and **Play on this phone**. Application routing uses the single `mode` query key. The former `role` query is deleted rather than retained as an alias; peer roles remain a transport-only concept.

All-in-one play:

- acquires the user-facing camera and starts MediaPipe only after the user presses **Start local play**;
- feeds each validated, canonical, unsmoothed `PosePacket` directly into the one shared body playfield in memory;
- creates no pairing key, peer room, Nostr/WebSocket connection, WebRTC connection, sender queue, or loopback transport;
- renders the same mirrored Main Menu, Draw, Bubbles, and Racing implementations with the same layout policies, controls, player modes, and quality settings as television display mode;
- keeps the required camera-capture video element visually hidden and renders no raw camera preview;
- starts with a one-pose limit and treats player-limit and camera-layout changes as complete only after the existing camera controller successfully applies them;
- requests fullscreen and a screen wake lock on a best-effort basis from the trusted start action, but never makes either optional API part of the blocking capability baseline;
- exposes an explicit stop action that releases camera tracks, the worker, pending requests, wake lock, and owned fullscreen state; and
- leaves screen mirroring, casting, or a wired display connection to the operating system and user. It has no universal Cast button.

The shared game/navigation component is named `BodyPlayfield`, not `TvPlayfield`. Presentation mirroring remains a playfield rule because the front-facing camera is expected to sit near the viewed screen; local execution does not mutate or mirror transport-domain landmarks.

The paired topology remains the canonical way to use an independent television browser. Local play is a separate first-class execution topology, not a compatibility fallback selected automatically after a peer or rendering failure.

## Consequences

### Benefits

- A weak television can display a phone-rendered game through external screen mirroring while all application work stays on the faster phone.
- Games, controls, layout gates, and renderer behavior remain one implementation rather than drifting into local and television variants.
- Local play works as a static GitHub Pages application and needs no runtime signaling or application server.
- The camera never appears in the rendered local-play screen, so external screen mirroring receives application graphics rather than an intentional raw-video preview.
- Removing network rendezvous from this mode reduces setup steps and isolates local play from relay and direct-connectivity failures.

### Costs and risks

- Camera inference and game rendering share one mobile thermal and frame budget; sustained real-device measurement is still required.
- The phone must be positioned far enough away to see the body while its display remains visible on the phone or mirrored television.
- Browser fullscreen and Screen Wake Lock support vary. Their failure is intentionally nonfatal and the browser may still dim or expose chrome.
- A visually hidden video remains an internal browser capture source because `requestVideoFrameCallback` and `createImageBitmap` require it. CSS or lifecycle regressions must not make its pixels visible.
- Operating-system mirroring can add latency or alter resolution, and JojixPlay cannot inspect or normalize that external path.

## Alternatives considered

### Render on the phone and stream an application video from JojixPlay

Rejected. Owning capture, encoding, discovery, and television playback would recreate a transport problem already solved by operating-system mirroring and would no longer be the simplest static fallback.

### Use a loopback Trystero/WebRTC room

Rejected. It would add network failure and serialization to a same-page data path and would obscure resource ownership without exercising a useful production boundary.

### Add simplified local versions of expensive games

Rejected. A second renderer or quality path would violate the one-canonical-implementation rule. Performance replacements must be evidence-driven hard cutovers of the affected canonical game.

### Keep the camera preview

Rejected by the product owner. The avatar, game feedback, status text, and orientation gate provide the intentional visual output; raw pixels are not part of the local-play presentation.

## Verification

- Routing tests prove exactly the three `mode` values and reject the removed `role` route.
- Component tests prove camera acquisition begins only after activation, no peer room is created, the video capture source is not presented as a preview, packets reach `BodyPlayfield`, reconfiguration is apply-then-display, and stop/unmount cleans up owned resources.
- Production-browser tests use fake media and the real vendored MediaPipe worker/model to reach the first local packet and verify the absence of visible camera video.
- The build proves Racing remains lazy and forced to Canvas while being reachable from either playfield host.
- Real-device acceptance records phone-only cadence, thermals, orientation behavior, fullscreen/wake behavior, and any external mirroring latency.

## Follow-up

- Complete the target-phone and external-screen-mirroring acceptance pass in [Project status](../project/status.md).
- Change no quality setting or game renderer until that measurement identifies the actual bottleneck.
