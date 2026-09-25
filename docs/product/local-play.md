---
status: Active
last_verified: 2026-09-25
---

# Phone play

An adult rotates the phone to landscape, sets up optional external screen mirroring and taps **Vamos começar** to grant camera access. The phone stays beside the television; every subsequent menu, help control, game selection and confirmation supports movement.

The **Menu principal** lists **Desenhar**, **Corrida dos Blocos** and one noninteractive **Em breve** placeholder. Future game names and rules remain the owner's choice. Choosing Desenhar opens **Sozinho** / **Em dupla**; the host applies one-/two-person inference before mounting the game. **Todos os jogos** returns from that choice, and confirmed game exit returns to the game list. Corrida opens directly after the host applies one-person inference. Neither return restarts the camera.

Outside games, the mirrored camera fills the complete viewport, with all UI on top. The aspect ratio is preserved by cropping overflow, never by stretching. Camera source rotation and crop are shared with hand projection so a button activates where the circle actually reaches it. Move the hand over a button for 800 ms, then move away before another selection. The button outline shows progress; no amplified reach exists. Missing and stale hands disappear. Only a wrist is required, with coarse index observations improving fingertip placement when available; no torso or leg readiness gate exists for menu interaction.

Small circles replace all hand meshes. The menu estimates an index position from the coarse index observation, otherwise a short forearm extension, otherwise slightly above the wrist. This heuristic is bounded to 8% of camera-frame height and is not finger tracking. Menus have no stick figure or body avatar. Games decide their own visuals and hide the camera presentation while reusing the same capture: Desenhar has an opaque painting surface; Corrida has a first-person world with a translucent live skeleton attached to approaching pose walls.

**Para os adultos** provides movement-operated scrolling, mirroring guidance, privacy information and local capture-age diagnostics. Camera pixels and coordinates are never recorded, stored, logged or transmitted. No microphone, account, backend or in-app television transport exists.

Explicit stop, portrait, camera failure and unmount release capture, inference, immersive state and render resources. A new capture requires trusted setup again. Model accuracy, alignment, heat and external-mirroring latency still require target-phone acceptance. Browser tests verify lifecycle, crop math and synthetic movement navigation, not physical tracking quality.
