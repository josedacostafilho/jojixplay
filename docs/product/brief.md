---
status: Active
last_verified: 2026-08-17
scope: Product purpose, users, constraints, and first outcome
---

# JojixPlay product brief

## Purpose

JojixPlay turns a phone into a private, camera-based body controller. A paired phone can send only pose landmarks to games rendered by a nearby television browser, or **Play on this phone** can run the complete playfield locally for direct use or operating-system screen mirroring. Camera pixels remain inside the phone capture/inference path in either topology.

The current product proof is a live procedural body-avatar viewer plus Draw, Bubbles, and Racing. Together they validate camera capture, on-device pose estimation, optional pairing/peer transport, direct all-in-one execution, readable pose presentation, body-operated navigation, continuous and discrete two-hand input, identity-independent one-/two-player scoring, timed gameplay, deterministic fixed-step steering, split-screen presentation, focused shared renderers, and one concrete lazy game-engine boundary.

## Primary users and setting

- People who want free, Kinect-like motion experiences using devices they already own.
- A modern phone with a camera, optionally paired with a television browser or externally mirrored/cabled to a larger screen.
- One player by default, with an explicit two-player detection mode for the first prototype.

The application needs network access to load uncached static assets. Paired mode additionally uses decentralized peer discovery; after WebRTC connects, pose traffic travels directly between devices. Local play creates no runtime peer connection.

## Core experience

1. Choose a topology: open **TV display** plus **Phone controller** for independent devices, or choose **Play on this phone** to run everything locally.
2. In paired mode, start TV mode and scan the QR code or enter its 20-character key. Local play has no pairing step.
3. From a trusted phone action, grant camera access and start pose tracking/local play.
4. See the default single detection rendered as an identity-independent mirrored faceless body avatar on the active playfield. Local play intentionally renders no camera preview.
5. Leave space above the head, raise one hand to claim control, and move the coarse-hand cursor clear once to arm Main Menu.
6. Open **Games** and select **Draw** to bring both hands together, activate Pencil or Eraser immediately, draw with the selected controller hand, and spread both hands wide to stop.
7. Or select **Bubbles**, start a three-second countdown, then use either complete hand to pop procedurally moving bubbles during a 60-second one- or two-player round.
8. Or select **Racing**, stand naturally through calibration, then lean left or right to steer an automatically accelerating car through a timed solo course or landscape split-screen race.

## Product invariants

- Camera frames and video streams remain inside the phone camera/inference path. The paired controller may show its own preview; local play never does.
- Where a peer exists, the network contract contains pose landmarks and minimal session metadata only. Local play creates no network session.
- No account, database, owned backend, analytics, or retained session data exists in the prototype.
- People are identity-independent detections. Array position is never an identity; only bounded playfield-local torso continuity for temporary menu control and Racing driver slots may preserve a short-lived lease.
- Two-player Bubbles scores belong to current mirrored screen-side slots. Crossing sides transfers later attribution; no score is attached to a person identity.
- Avatar stabilization is a private display copy. Controls, Draw, Bubbles, Racing, diagnostics, and transport never consume it.
- The application shell does not depend on a particular game renderer.
- Each future game selects exactly one renderer and loads it only when needed.
- The repository remains greenfield and follows mandatory hard cutovers under [ADR-0001](../decisions/0001-greenfield-hard-cutover.md).

## Prototype non-goals

- Accounts, saved artwork, scores, race times, a broad game catalogue, audio, obstacles, car collisions, or online competition.
- Stable player identity, persistent/general-purpose cross-frame person tracking, profiles, or accounts; the temporary local control lease is the only bounded continuity exception.
- Camera-pixel streaming, recording, upload, or persistence.
- TURN service, relay transport, transport fallbacks, or offline peer discovery.
- Supporting obsolete browsers through polyfills or alternate implementations.

## First-outcome success criteria

The prototype succeeds when the journeys in [Phone-to-television specification](skeleton-viewer.md), [Play on this phone](local-play.md), [Avatar renderer](avatar-renderer.md), [Draw game](draw-game.md), [Bubbles game](bubbles-game.md), and [Racing game](racing-game.md) work on target devices; one or two detected bodies render continuously where intended; the one-person avatar is visibly steadier without unacceptable fast-motion lag; menus, continuous tools, collisions, and steering operate without unacceptable false activations or latency; timed scores and races remain legible and correct; the forced-Canvas Racing runtime sustains the selected playfield device; local inference-plus-rendering stays acceptable on the phone; failures are actionable; and inspection confirms that camera pixels neither cross the peer connection nor enter the local-play presentation.
