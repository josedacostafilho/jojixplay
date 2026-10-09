---
status: Accepted
date: 2026-10-08
---

# Games own their controls; pose frames bypass interface state

Amends [ADR-0024](0024-movement-navigation.md) and [ADR-0028](0028-contextual-race-actions.md). Every post-setup action is still operated by movement, and Corrida keeps its amplified reach. What changes is who owns the in-game controls and how frames reach consumers.

## Context

The host drew **Voltar** and its confirmation over each running game. To aim a hand at those controls it queried game DOM by class name and re-derived each game's projection: Desenhar's paper fit and Corrida's amplified reach. It also styled its dialog with a game's CSS class. Two dwell controllers therefore ran at once during a game, coordinated only through a document-wide open-dialog lookup, and a change inside a game could silently break host navigation. The SDK contract described as narrow was bypassed through the DOM.

Each pose packet was also stored as page state, so the whole interface rerendered at camera rate. Engineering standards already forbid routing frame scheduling through component rerenders, and unnecessary work is heat on the target phone.

## Decision

- A mounted game owns every control visible while it runs, including **Voltar** and its confirmation. The host passes a `GameHost` whose only member is `exit()`; a game calls it after the players confirm. The host renders nothing over a game and never queries a game's DOM, classes or projection.
- Exactly one dwell controller is active at a time: the host's in menus, the game's in a game. A controller sees only buttons and an open modal dialog beneath its own root.
- A game that fails to load or mount returns the players to the menu with an actionable message. No host control is needed inside a game that never started.
- The amplified hand projection has one consumer and lives in Corrida, not the SDK.
- Pose frames are published through a subscribable channel. Games receive them directly from the camera callback; the menu pointer reads the latest frame each animation frame. Interface text derived from frames (hand visibility, diagnostics) samples the channel at a slow fixed interval. No frame is component state.
- Desenhar renders its controls with Preact, like Corrida, and redraws its WebGL surface only when a brush, the art, the layout or a dialog changed.

## Consequences

Adding a game needs no host change beyond one registry entry. Each game repeats a small exit button and confirmation in its own visual language; two games do not justify a shared component. The frame-derived menu note can lag a hand by up to its 200 ms sampling interval. A game is responsible for staying exitable in every state it can reach, including loading and error states; the movement-only browser journey exercises exit from both games.
