---
status: Accepted
date: 2026-10-09
---

# Corrida becomes a third-person puppet run, built from the feel outwards

The view from behind chosen here was replaced by a first-person view in [ADR-0038](0038-corrida-first-person-depth-and-punch.md) after the owner tried both; the control described here stands.

Supersedes [ADR-0028](0028-contextual-race-actions.md) and what remained of [ADR-0027](0027-corrida-gesture-camera.md). [ADR-0029](0029-game-owned-controls-and-frame-channel.md) stands: the game owns its controls.

## Context

The owner found the first-person Corrida barely usable. The player never saw themselves. Jumps and ducks were guessed from shoulder height through a stack of thresholds and confused with each other. Starting needed a three-second held crouch. Large buttons sat in the play area, text panels announced each obstacle over the obstacle, and long quiet stretches ended in a run-ending loss of hearts.

Showing the player's own camera image or silhouette as the runner was ruled out: the phone stands by the television facing the player, so their image faces them while the course runs away from them, and they would appear to run backwards.

## Decision

- **Third person, with a character.** The player controls a character in the 3D world, seen from behind, running away from them. The character copies the player's arms, lean and crouch continuously, so the player always sees themselves acting. Seen from behind, the player's left is the character's left on the left of the screen.
- **Normalized to the player's body.** Lane width comes from shoulder width, crouch from torso length, and both are fixed when a run starts. The character has one set of proportions. A small child and a tall adult get the same character movement for the same effort.
- **Three lanes, a free character.** The road is three equal lanes with no visible division. The character slides exactly as the player steps; the game separately decides the lane, with a margin so it cannot flicker, and shows it only as a patch of light on the road. Lanes are centred on where the player stands at the start, which must be in the central half of the camera's view, and are narrowed if needed so all three fit in the view. The road's edges are where the lanes end, not where the camera's view ends.
- **Hips decide the lane, shoulders against hips decide lean.** Leaning is going to be part of pose walls, so it must not move the player out of a lane. Changing lane takes a step.
- **No jumping.** It is hard to detect, hard for small children and not worth either. Reversed by [ADR-0035](0035-corrida-literal-rules.md).
- **Planned actions:** step to another lane, duck, pose walls (always in the middle lane; arms and lean, a raised leg only as an optional bonus because legs are the least reliable thing the camera sees), and reaching to collect. Standing still as an action was rejected because pose readings tremble. Pose walls and collecting were built, tried and removed, and jumping returned in a different form: see [ADR-0035](0035-corrida-literal-rules.md).
- **One character for every theme.** It is a simple rounded figure, not block-built, and its look is behind a small pose interface so a modelled character can replace it. The block forest is a theme around it.
- **Feel first.** The first build is the character and its control on an empty road. The course, scoring and the rest are designed only after the owner has tried that on a phone and television.

## Consequences

The first build was the control alone on an empty road; obstacles followed once the owner had tried it. Corrida still has no run length or ending. The earlier rules, gesture recognition, first-person scene, amplified hand reach, help and pause were deleted with their tests. Pose tracking is flat: arms copy well in the plane facing the camera and not in depth. Every threshold is untried on a phone. The single exit control is a held corner button reached with a real hand that the player cannot see on screen until it is over the button; where pause and exit belong is an open question for the finished game.
