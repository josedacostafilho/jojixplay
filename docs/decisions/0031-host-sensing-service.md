---
status: Accepted
date: 2026-10-09
---

# Sensing is a host service; games interpret

Amends [ADR-0022](0022-independent-3d-platform.md) and [ADR-0029](0029-game-owned-controls-and-frame-channel.md). The narrow host contract, game-owned controls and the frame channel stand. What changes is that the host can sense more than bodies, and a game can ask for what it needs.

## Context

Body pose was the only thing the host turned camera images into, and it was baked into every name in the pipeline. The owner expects many games with different ways of interacting. An earlier game brought hand tracking in as a second, special path through the worker and the page; it was removed with that game. Repeating that for each new kind of sensing would duplicate the hard part, camera images to keypoints, once per game.

## Decision

- An interaction has two halves. **Sensing** turns camera images into observations and belongs to the host, once, for every game. **Interpretation** decides what an observation means (a wrist over a button, a pinch, a pose) and belongs to each game. The SDK carries observations and no gestures.
- The SDK names each kind of sensing. Today: `body` (Full Pose, named joints) and `hands` (Hand Landmarker, two hands, 21 named points each, reported by the person's own side). Depth and body-with-depth are intended next and are not built; no code or type stands in for them.
- One frame type carries everything sensed in one camera image plus which sensing produced it. `BodyFrame` and `HandFrame` are the parts of it; a game types its input by the part it reads, so a body game is untouched by new kinds of sensing.
- A session senses bodies unless a running game asks otherwise through `GameHost.sense(kind)`. The host applies the change between frames, starts a new frame epoch so nothing from the previous model is read as the new one's output, and returns to bodies when the game ends, before the menu will open another game. A change that cannot be applied ends the session with a message.
- A worker holds exactly one model task for its whole life. A change stops that worker and starts another with the other model, while the camera stream keeps running. Two models never run together, and the previous model's memory goes with its worker. A model file is fetched the first time it is sensed with. Swapping tasks inside one worker is not possible: the MediaPipe runtime cannot build a second task in the same module worker.
- A game may ask the host to show the camera image behind it with `GameHost.showCamera`. The image stays the host's element: mirrored and covering the viewport. The SDK exports that cover mapping so a game can draw over it exactly.
- `games/sensores` is the owner's bench for looking at each kind of sensing without a game's rules in the way: the sensed figure over the camera image or a plain background, with a reading rate and delay. It appears on the menu shelf like a game and is expected to be removed or hidden before children use the product.

## Consequences

A new kind of sensing is added in one place: a model, a worker branch, a validated packet shape and an SDK type. The pose-era names of the host's worker, estimator and camera controller files are kept; they now carry every kind of sensing. A game that needs it adds one call. Switching starts a worker and builds a GPU graph, and takes a moment, during which nothing is sensed; a game must show that it is waiting. Combined sensing, such as body with depth, will need the single-task rule revisited with phone heat measurements. The bench is product surface that is not for children while it stays on the shelf. Hand detection at across-the-room distance is unmeasured: the hand model expects a hand that fills a fair share of the image.
