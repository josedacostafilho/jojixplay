---
status: Active
last_verified: 2026-09-24
scope: Phone-only runtime boundaries and data flow
---

# Architecture overview

## Current system

One static Preact application runs entirely on the landscape phone. GitHub Pages serves the assets; operating-system or wired screen mirroring provides the television display. There is no application backend, persistence, signaling, peer transport, or TV browser runtime.

```text
landscape gate → trusted Start → hidden front-camera video
                                      ↓
                          source normalization / MediaPipe worker
                                      ↓
                          validated in-memory landscape PosePacket
                                      ↓
                        mirrored BodyPlayfield / body controls
                                      ↓
                Draw Canvas / Bubbles Canvas / lazy Phaser Canvas Racing
                                      ↓
                          phone screen + procedural Web Audio
```

## Ownership

- `App` owns the landscape gate and root-link validation. Portrait unmounts the run.
- `LocalPlayPage` owns camera activation, freshness, player selection, audio, optional immersive resources, Stop, and teardown.
- `useCameraPose` owns one `CameraPoseController`. The controller handles camera-paced single-flight inference, source basis stabilization, epochs, and direct player-limit changes.
- The worker alone imports MediaPipe. Camera pixels remain within the camera/bitmap/worker boundary.
- `BodyPlayfield` owns view transitions, temporary body-control leases, game sessions, and semantic audio events. All action sets replace atomically and require neutral re-arming.
- Pure game sessions own rules and timing. Draw/Bubbles use focused Canvas renderers; Racing alone lazy-loads one forced-Canvas Phaser adapter. Rendering owns no inference or transport.
- Avatar presentation is an isolated display copy, never a source of game input or identity.
- One phone-owned native Web Audio runtime starts only through trusted activation and closes on teardown.

[ADR-0021](../decisions/0021-landscape-phone-only.md), [Phone play](../product/local-play.md), and [Camera orientation](../product/camera-orientation.md) define the topology. Independent game/render/audio contracts remain in [Product docs](../README.md).
