---
status: Superseded by ADR-0028
date: 2026-09-25
---

# Game-owned first-person gesture feedback

Corrida dos Blocos introduces a single-player first-person run with camera motion and pose-wall matching. Keep these interpretations in `games/corrida`, consuming the existing raw named-joint SDK; neither the host nor the SDK acquires obstacle, scoring, pose-template or camera-motion rules. The host applies one-person inference before entry and retains permission, capture and confirmed exit ownership.

The owner explicitly requires jumps and crouches to move the viewpoint even between obstacles, while avoiding motion sickness from noisy estimation. Use discrete gesture evidence, hysteretic crouch state and bounded eased camera animations rather than mapping observed head/shoulder coordinates directly to the camera. Keep the horizon level. This trades literal body displacement for predictable feedback and leaves recognition thresholds local and tunable through phone acceptance.

Pose walls retarget available observed limb directions into the wall's own coordinate space. Common limb lengths support children and adults without fabricating missing limbs. Matching at arrival determines success; rendering an earlier green preview is not a pass. Freeze time on unavailable tracking instead of charging lives for missing observations. No new inference path, game framework or persistence is introduced.

Pure game tests cover the complete five-minute run, noisy movement, camera response and pose timing. Browser tests cover integration and rendering; real-phone movement comfort and recognition remain mandatory acceptance work.
