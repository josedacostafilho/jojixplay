---
status: Active
last_verified: 2026-08-14
scope: Runtime player-limit selection, bidirectional session control, and MediaPipe reconfiguration
---

# ADR-0006: Session player-limit control

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** The Skeleton palette action and television-local-only action constraint in [ADR-0005](0005-mirrored-tv-pose-controls.md)
- **Superseded by:** [ADR-0010](0010-menu-and-draw-game.md) for retained circle-effect references; [ADR-0014](0014-procedural-body-avatar.md) for visible palette presentation

## Context

The prototype initially configured MediaPipe to detect up to two poses at all times. The immediate product remains a single-controller experience, while multiperson detection is useful only when deliberately testing two-player behavior. MediaPipe can avoid extra landmark work in one-player mode and enables temporal landmark smoothing only when its maximum pose count is one. The alternative skeleton palette was an acknowledged placeholder and has no durable product purpose.

The player limit controls inference running on the phone, but the body-operated control surface runs on the television. A television-only visual toggle would therefore lie about the active MediaPipe configuration. The session needs one small, explicit television-to-phone command with a positive acknowledgement.

## Decision

### Player-mode contract

- Every new pairing session starts in **one-player mode**. One-player mode configures MediaPipe with `numPoses: 1`; two-player mode configures it with `numPoses: 2`.
- The television's middle pose button is **Players: 1** or **Players: 2** and requests the opposite absolute limit. It replaces the former Skeleton palette button and remains a semantic remote- and keyboard-operable button.
- Player mode limits simultaneous identity-independent detections. It does not create, transmit, persist, or infer player or person identifiers.
- Stop/start of body tracking within one live pairing session retains the last acknowledged limit. A disconnected or newly created pairing session resets to one player.
- The current avatar uses one fixed two-color palette. Simultaneous pose-array positions may select different colors for the current frame but never imply stable identity. Visible material behavior is governed by [ADR-0014](0014-procedural-body-avatar.md); the former circle-effect sentence was superseded by [ADR-0010](0010-menu-and-draw-game.md).

### Bidirectional command and acknowledgement

- The direct WebRTC DataChannel remains the only application transport after rendezvous. Add one typed request/response action from television to phone alongside phone-to-television pose packets; do not add a backend, relay fallback, second peer connection, or media track.
- A command is the strict object `{ poseLimit: 1 | 2 }`. The phone validates the exact shape and authorized peer before applying it. The acknowledgement repeats the exact applied limit and is validated by the television.
- Commands are absolute and idempotent. A generic toggle message is forbidden because a lost response or retry could make the peers disagree.
- The television changes its displayed mode only after the matching acknowledgement. While a request is pending, every pose action is suspended and the semantic controls are disabled. Failure leaves the last acknowledged television mode visible and produces an actionable announcement.
- The peer protocol is hard-cut over to the new contract. A client using the former handshake is rejected; no version negotiation, compatibility parser, or legacy action remains.

### Phone reconfiguration lifecycle

- The phone pauses new frame submissions, lets any owned inference complete, and calls MediaPipe's supported `setOptions({ numPoses })` on the existing worker-owned landmarker. It does not reacquire the camera, redownload the model, reload the page, or maintain parallel landmarkers.
- Only one reconfiguration may be active. A request received without active body tracking or while another change is active fails explicitly.
- A successful change updates phone session state and acknowledges the applied limit. A MediaPipe reconfiguration failure is terminal for that tracking run because the graph's state cannot be asserted safely; the phone stops owned camera/worker resources and surfaces the failure.
- Reconfiguration may briefly interrupt fresh packets. The television keeps its current temporary controller lease and relies on the existing freshness, nearest-torso, and pose-loss rules. If the selected body cannot be reacquired, the normal lease-release behavior applies.

## Implementation and validation plan

1. Add one strict player-limit domain type and parsers shared by transport, phone state, worker protocol, and UI.
2. Extend the peer room with an authenticated request/ack action and bump the handshake protocol in one hard cutover.
3. Make the phone retain session mode, coordinate frame pausing with worker `setOptions()`, acknowledge success, and cleanly fail a broken reconfiguration.
4. Replace the Skeleton action with the dynamic Players action, delete the alternative palette, and preserve the other two prototype effects.
5. Cover exact request/ack validation, obsolete handshake rejection, authorization, timeout/failure UI, mode retention/reset, action suspension, and one-/two-pose worker options at the lowest reliable test levels.
6. Run the complete canonical validation suite and repeat real-device acceptance for mode switching, smoothing, performance, control continuity, and two-person detection.

## Consequences

### Benefits

- The common one-player session uses the least required inference work and gains MediaPipe's single-pose temporal smoothing.
- Two-player testing remains available from the body-operated television UI without touching the phone.
- Request/ack semantics prevent the two screens from silently reporting different modes.
- The first bidirectional command establishes a small validated control boundary that future session settings can replace through hard cutovers when genuinely required.

### Costs and risks

- Rebuilding MediaPipe's graph can produce a short visible pause and must be measured on target phones.
- In two-player mode, pose-array order remains unstable and landmarks are not temporally smoothed by the current MediaPipe graph.
- Limiting output to one pose does not select a particular person. Occlusion or another person entering the frame can cause reacquisition of a different body.
- A terminal configuration failure requires the user to restart tracking rather than attempting an unverifiable fallback.

## Alternatives considered

### Keep two-player inference permanently enabled

Rejected because it spends work and forfeits single-pose smoothing for a capability that is not the default experience.

### Put the player switch on the phone

Rejected because paired interaction is intentionally television-led and body-operated. The phone remains responsible for applying the setting, not for requiring a second physical interaction.

### Restart the camera and worker on every switch

Rejected because MediaPipe exposes runtime option replacement. Restarting would add permission/lifecycle disruption without improving correctness.

### Optimistically toggle the television before acknowledgement

Rejected because a failed or delayed command would display configuration that the phone never applied.

## Verification

- Unit tests prove strict messages, request/ack matching, peer authorization, obsolete handshake rejection, worker option messages, and serialized reconfiguration.
- Component tests prove dynamic accessible labels, disabled/pending behavior, success acknowledgement, failure announcement, and continued background behavior. [ADR-0010](0010-menu-and-draw-game.md) governs the replacement menu and game coverage.
- The production build proves the phone remains the only MediaPipe importer and no alternate transport or landmarker is bundled.
- Real-device acceptance records mode-switch latency, sustained inference behavior, one-player stability, two-person detection, and controller continuity.

## Follow-up

- Record measured performance and interaction findings in the canonical status/backlog documents; change the accepted defaults only from evidence and through a hard cutover.
