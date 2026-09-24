---
status: Active
last_verified: 2026-09-24
scope: The only application journey and resource lifecycle
---

# Play on your phone

## Journey

1. Open the root website on the phone. In portrait, only **Rotate your phone** appears. Enable screen rotation and turn the phone sideways.
2. Mirror the phone using operating-system screen mirroring or a wired display when a larger screen is wanted. The TV runs no application.
3. Prop up the phone with its front camera facing the players' full bodies. Press **Start playing** to activate camera, tracking, and sound.
4. Raise a hand to claim the mirrored controls (both hands when multiple people are visible), move clear of the targets to arm them, then select Games. Draw, Bubbles, and Racing share this one playfield.
5. Press **Stop** to release camera, worker, sound, game runtime, wake lock, and owned fullscreen/orientation lock.

## Runtime contract

- There is one entry point, with no mode query, pairing key, peer connection, preview, or remote controller. Query strings and fragments fail clearly with a root-link recovery action.
- Camera pixels remain on the phone. The internal video stays visually and accessibility hidden; no video or landmark data is sent, stored, or logged.
- Validated landscape packets travel directly from the camera lifecycle to `BodyPlayfield`; packets expire after one second without an update.
- Every run begins with one-pose inference. Selecting Players applies the new limit to the camera before updating the displayed mode; failures are announced.
- Start attempts fullscreen, landscape orientation lock, and Screen Wake Lock. These platform enhancements may be rejected. Portrait never exposes setup or gameplay: rotating upright unmounts the run and stops every resource. Returning to landscape requires a new Start and clears ephemeral game state.
- One native audio context belongs to this phone run. Sound preferences are page-session-local; see [Audio](audio.md).
- Camera access requires HTTPS or localhost. Unsupported required APIs produce an actionable unsupported-device panel.

[ADR-0021](../decisions/0021-landscape-phone-only.md) governs the hard cutover. Real-phone and external-mirroring acceptance remains outstanding.
