---
status: Accepted
date: 2026-09-25
---

# Contextual race actions and reachable controls

Supersedes [ADR-0027](0027-corrida-gesture-camera.md). The owner's phone trial found that jump preparation caused unwanted ducking and literal jump recognition was too demanding. The owner now requires actions to follow the upcoming obstacle. Corrida alone interprets this context: duck beams permit camera crouching, jump barriers permit symbolic dip-and-rise or modest upward movement, and walls permit pose matching with a stable viewpoint. Entry still requires a held crouch, without moving the camera. Bounded eased animation, normalized wall previews, arrival-time pose scoring and tracking-loss pauses remain game-owned.

The owner also found the initial controls and text unusable across the room. Camera-hidden race controls now show hand circles continuously and amplify the central wrist workspace. A single SDK projection is used by the game and host-owned race exit/confirmation controls, with the same point for display and hit testing and no whole-body prerequisite. Camera-backed menus retain exact cover alignment, and drawing retains its paper projection. This deliberately trades literal hand location for reachable targets only where no camera image requires alignment. Essential race text stays large; reduce copy instead of shrinking it to fit. Real-phone/TV acceptance remains separate from synthetic browser coverage.
