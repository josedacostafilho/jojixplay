---
status: Accepted
date: 2026-10-08
---

# The menu hangs on the player's body

Amends [ADR-0025](0025-camera-menu-and-authored-hands.md), [ADR-0026](0026-circle-menu-pointer.md) and [ADR-0024](0024-movement-navigation.md). The fullscreen mirrored camera, exact cover projection and movement-only operation stand. The screen-laid-out game list, the adult panel inside the tracked session and the silent interface are replaced.

## Context

The game list was a row of large cards across the camera image, with further dwell targets in the corners. Players stand across the room in front of a mirrored television; a hand had no place to rest that was not a target, and a card could be chosen before a child had looked at it. The owner rejected two redesigns that rearranged large buttons on the screen for the same reason, and expects dozens of games.

## Decision

- Outside games the screen is the mirror and the menu is a few small objects attached to the player's body. The game in focus floats above the head; one bubble sits at arm's length on each side at shoulder height. Raising a hand to the card and holding it plays that game. Stretching an arm to a bubble turns the shelf, and holding keeps turning. A game offering one or two people shows that choice on the same two bubbles, with the card as the way back.
- Positions are measured in shoulder widths from the shoulder midpoint, so the same arm movement works for a child and an adult wherever they stand. The distances are phone-tuning parameters in one module. A hanging arm must reach nothing: rest is the default everywhere on screen.
- The menu attaches to the most central person whose two shoulders are visible. Without one it shows a single prompt and no targets. This deliberately drops wrist-only menu operation; shoulders are needed to place the objects.
- Anchor position follows the body with light smoothing, and its size shrinks slowly, so turning sideways does not pull the objects in. The hand ring still sits on the unsmoothed estimated index point, which is also the point tested against objects.
- Other games appear beside the focused card as pictures only. Adding a game is one registry entry with a picture, a colour and a one-word label.
- The dwell controller gains a per-button hold time and hold-to-repeat. Ending the session is a small corner target with a two-second hold.
- The start screen is the adult's only touch screen: three setup steps, a privacy line and one button. The scrolling guidance panel and its game instructions are removed; games explain themselves. A one-line capture-age readout stays in the menu for phone tuning.
- The interface makes three short synthesized sounds (turn, select, back) through Web Audio, started by the same trusted touch as the camera. No audio files, no microphone, silent where audio is unavailable. Game sound remains each game's future decision.

## Consequences

The screen is almost empty and a relaxed player selects nothing. Reach distances can only be validated on the target phone with real children and adults; synthetic tests prove geometry and wiring, not comfort. A player cropped at the shoulders or standing at the very edge of the frame cannot operate the menu until they step into view. Browsing is one game per step, so a long list will need grouping; that is deferred until the list is long.
