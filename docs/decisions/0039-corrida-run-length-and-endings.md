---
status: Accepted
date: 2026-10-09
---

# A Corrida run is five minutes to a finish line, and can be failed

Extends [ADR-0038](0038-corrida-first-person-depth-and-punch.md). Decided by the owner.

## Decision

- **A run has a fixed length:** five minutes for now, to a finish line. The road is clear for the last stretch before it. Crossing it ends the run with a choice to run again or leave.
- **Running out of hearts fails the run**, with the same two choices.
- **While the game is being tried out the player is immortal:** hearts that run out come back and the run goes on. This is one option of the run, set where the host mounts the game; the failing rule is built and tested behind it.
- **Points stay a plain count** and are not part of either ending yet.
- **Hanging from rails tilts the view.** While the character hangs, the view draws back a little and looks up, so the hands on the rails are seen; this is the game's own movement of the view, unlike the roll with the player's lean that was removed.

## Consequences

Starting again lays the same road, since a run keeps its seed; whether a retry should be the same road is undecided. Nothing yet shows how far along a run the player is. Five minutes is long for a small child and is the owner's starting number, not a measurement. Both end screens are operated by held hands like every other control, with the corner exit giving way to them.
