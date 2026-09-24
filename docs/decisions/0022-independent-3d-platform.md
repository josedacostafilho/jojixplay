---
status: Accepted
date: 2026-09-24
---

# Independent 3D platform

The owner requested retirement of every existing game, a complete children's UI replacement, isolated games, and partial-body tracking. Ages are 4–7 with an adult nearby. Future games belong to the owner; the first new Draw is deferred.

Use npm workspaces, Preact for application UI and Three.js WebGL2 for scenes. Remove Phaser, Canvas 2D rendering, old gestures, avatars and games completely. Blender-authored GLB is the asset interchange for future authored game models; no game or asset production framework is prebuilt.

The application owns camera permission, worker inference, landscape gating and immersive resources. The small game SDK exposes readonly named joints, independent availability, canonical frame metadata and a mount/update/dispose lifecycle. Games own their rules, assets, presentation and interpretation. No game imports another game or application internals. A separate development application exercises the same contract with synthetic partial-body input. The shared movement view is a diagnostic, not a game.

Replace Lite CPU inference with one self-hosted MediaPipe Full GPU worker. There is no alternate model or CPU fallback. Full is a candidate improvement, not a proven phone benchmark. Heavy adds compute without evidence it meets latency requirements. MoveNet's higher-accuracy Thunder is single-person; its multiperson variant is Lightning. Neither eliminates the application's need to treat joints independently. Validate Full on target phones before claiming quality acceptance.

Unavailable hips or legs must never invalidate visible arms. Each joint is independently confidence/bounds filtered. Raw observations remain unsmoothed and unmirrored; presentation may interpolate only within a fresh single-person frame basis. Two-person array order is not identity. No coordinate recording or remote camera processing.

This supersedes the game, Canvas, gesture-menu and audio implementations in ADRs 0003, 0005, 0008, 0010–0014, 0016–0020. ADR 0021's phone-only landscape policy remains active. Existing useful camera normalization, validation and resource ownership are retained.
