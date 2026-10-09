---
status: Accepted
date: 2026-10-09
---

# A row of three games, bounded sizes and holds that survive flicker

Amends [ADR-0030](0030-body-anchored-menu.md) and [ADR-0024](0024-movement-navigation.md) after the owner's first sessions with the body-anchored menu on a phone and television. The menu still hangs on the player's body and a hanging arm still reaches nothing.

## Context

Close to the camera the buttons grew without limit. The side bubbles often would not respond with the hand ring plainly on them, mostly up close, and the menu seemed to need both hands tracked. With the shoulders high on screen, the bubbles ran into the game card, which had stopped at the top edge. One selectable game at a time is slow for a list that will grow.

The unresponsive bubbles came from the shared hold rule: a hand could only start a hold after being seen away from every button, and a hand lost by tracking for a single frame came back as a new, unarmed hand. Up close, hands hang below the picture and are raised straight onto a button, and joints near the picture's edge flicker, so holds silently never started. Nothing required two hands; each dropout disarmed one.

## Decision

- **Holds survive flicker.** A hand lost for up to 400 ms keeps its hold and continues where it was. A hand raised straight onto a button holds it at once. Only a hand that is already present when the buttons change (a menu or dialog appearing, a choice just made) must leave its button first, so a button appearing under a resting hand still cannot fire. This is the SDK's one hold implementation, so games' own buttons behave the same.
- **Three games are selectable at once**, in a row above the head: up and to the left, straight up, up and to the right. A small preview at each end of the row shows what comes next and cannot be chosen. A side bubble moves the row by one game; holding keeps moving. Places with no game yet are drawn dashed and are not targets.
- **Sizes are bounded above as well as below.** Cards and bubbles still follow shoulder width, between a pixel floor and a ceiling given as a share of the screen height, and the row never exceeds the screen width. Reach distances still follow the body.
- **Bubbles slide down, the row stays up.** Bubbles belong at shoulder height. When the row has stopped at the top edge and the shoulders keep rising, the bubbles keep a fixed gap below the row instead of entering it. The change is continuous. The row is not moved to the bottom of the screen: that is where relaxed hands hang.

## Consequences

A relaxed player still selects nothing. Very close to the camera the bubbles sit at the screen edges below shoulder height, which is reachable but no longer a natural sideways stretch; no prompt asks the player to step back. A hand that reappears on a different button after a short loss starts that button's hold from zero. The ceilings and the gap are tuning parameters to settle on a television.
