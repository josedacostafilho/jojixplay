---
status: Active
last_verified: 2026-09-24
---

# Phone playroom

Audience: children aged 4–7, with an adult helping or playing alongside them. A warm cream, coral, yellow and green interface uses large touch targets and a Three.js toy scene. The current experience is a movement check, not a game catalogue. Existing Draw, Bubbles and Racing are retired. The owner will specify a new Draw separately.

Portrait displays a rotate prompt before camera activation. Landscape shows the playroom. **Let’s get ready** asks for camera permission and attempts fullscreen, orientation lock and wake lock. Unsupported optional immersive APIs do not block use. Portrait always tears down the session.

Put the phone somewhere steady with shoulders and hands in view. Feet and legs are not required by the movement check. Every joint is independently available, so missing hips cannot erase visible arms. A wave produces a mirrored Three.js visualization. **Add a grown-up** requests two-person inference and changes the displayed mode only after successful application. Neither person must match the other's height. **Finish movement check** releases capture and inference.

**For grown-ups** provides setup, external phone mirroring guidance, privacy information and live capture-age diagnostics. This is adult-assisted setup; there is no body-controlled menu or game reading requirement.

Camera pixels stay hidden and on-device. No microphone, recording, coordinate logs, network pose messages, persistence or account exists. The model may still fail to detect a severely cropped or occluded person; independently available joints only help after detection. Model accuracy, latency and thermal acceptance remain unverified on target phones.
