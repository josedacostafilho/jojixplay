---
status: Accepted
date: 2026-10-09
---

# Corrida through the character's eyes, with arms in depth and punching

Extends [ADR-0035](0035-corrida-literal-rules.md) and replaces the view chosen in [ADR-0034](0034-corrida-third-person-puppet.md), whose control (lanes, crouch, measuring in the player's own body) stands. Uses the body in its own space from [ADR-0036](0036-body-in-its-own-space.md).

## Context

With each body also reported in its own space, the character need not flatten the player's arms onto the screen. The owner asked for arms and torso in depth, and for a new action, punching. They also doubted the third-person view: seen from behind, an arm thrown forward is hidden by the character's own back, while through its eyes it is the most visible thing on screen. Against that stood three worries: tracking tremor moves a puppet a little but the whole picture in first person; lanes are harder to judge with no body on screen; and a small child loses the sight of a character copying them.

The rules do not depend on where the road is watched from, so both views were built on the same run with a button between them and tried by the owner on a phone and television. First person "works wonderfully"; the view from behind was dropped. One part of it failed: rolling the view with the player's lean was "very shaky and adds nothing". And punching was "a bit of a shot in the dark": nothing showed when a punch had been read.

## Decision

- **The road is seen through the character's eyes.** The view sits at its head, moves across with steps, down with a crouch and up with a jump, looks level and does not follow the body's angles: it does not roll with lean and does not nod. [ADR-0040](0040-corrida-pace-and-acting-view.md) later lets the game itself move it. It follows a little more slowly than the arms.
- **Only the arms are drawn**, where the tracked arms are and nowhere else: hanging arms are out of sight. The full character, its legs and the view from behind are deleted.
- **Arms come from the body's own space.** Upper arm and forearm each point the way the player's does, in three dimensions. Forward lean of the torso moves the shoulders and head when standing; a crouch keeps its set forward tip, so the two never add up. Lane, crouch and jump stay on the camera image, which alone says where the player is.
- **Rules still judge height and width only.** A hand holds a rail when it is above the head; an arm pointing forward is lower and does not count as raised.
- **Depth is followed more slowly** than the rest when drawing, because it is the least steady axis. Rules read it unsmoothed.
- **A punch is a quick move forward, from wherever the arm is:** the wrist going forward by 20% of its arm's length within 260 ms (25% within 200 ms proved a little unforgiving on the phone) and ending in front of the shoulder, re-armed once it has come back 15% from its furthest. It is measured across a short window and not between two readings, because depth is the noisiest reading and speed between readings amplifies noise. The first rule, a fixed distance in front of the shoulder with a fixed distance to come back to, failed on the phone: hands that are in view are usually already past it, so gloves stayed red and jabs from a guard did not count.
- **A punch that has been read is shown at once:** that arm's glove flashes red for a quarter of a second. It reports the reading, not the outcome; a monster flying off is the outcome, with a burst of stars for show.
- **Monsters.** Big, in one lane, unavoidable: unpunched, one costs a heart wherever the player stands. A punch thrown in a hidden stretch before it knocks it away for points; the stretch was widened after play on the phone and later, at a faster pace, cut to what looks like arm's reach ([ADR-0040](0040-corrida-pace-and-acting-view.md)). The lane decides the arm: left for the left lane, right for the right, either for the middle, and either for a player standing in the monster's own lane, where it is straight ahead. This is the jump's rule again: brief actions are judged by when they begin, inside a stretch, and are free elsewhere.
- **Points** are a plain count until the shape of a run is decided.

## Consequences

Corrida reads `WorldFrame` as well as `BodyFrame`. Hands holding the rails were above the view at first; [ADR-0039](0039-corrida-run-length-and-endings.md) tilts the view up at them while hanging. Blocks must be judged without a body on screen, by the lane light and the view's own position. Still untried or unmeasured: whether a wrist thrown straight at the camera stays tracked at full reach, since the fist hides the forearm and elbow just then, and a reading without the whole arm tells nothing, so a punch whose end is not seen is not a punch; the punch's distance and time, which a small child's jab may fall short of; and how much the arms tremble in depth.
