---
status: Accepted
date: 2026-10-09
---

# Corrida runs faster, and its view acts out what happens

Extends [ADR-0038](0038-corrida-first-person-depth-and-punch.md) and [ADR-0039](0039-corrida-run-length-and-endings.md).

## Context

Two movements of the first-person view had been tried. Rolling it with the player's lean failed: it was "very shaky and adds nothing". Tilting it up at the hands while hanging from rails was "absolutely amazing", and the owner asked for more of that everywhere, and for the whole game to be faster. They also said not to hold effects back on account of young players.

The difference between the two is where the movement comes from. The roll followed a tracked angle, tremor and all. The tilt is set off by the game at a moment it chooses and eased.

## Decision

- **The view never follows the body's angles.** It follows where the player is (steps, crouch, jump), as before.
- **The view acts.** Movements set off by events in the run, each eased in and out: a stride bob, a lean into each lane change, a look down over a log and a dip on landing, a turn towards a nearing monster, a lunge and jolt when a punch lands, a swing while hanging, a pitch down into the pool and a wade, a recoil on a hit, and a lift at the finish. A hit takes over from the others while it lasts.
- **Time slows through the last stretch before the finish.** It is the run's own clock that slows, so the road and everything on it slow together. A moment of slowed time when a punch landed was tried and removed: it felt like hitting a wall.
- **The road runs at 16 world units a second,** up from 7. A first step to 10 still looked like "a fitness run" to the owner. Obstacles come about a second and a half apart, down from three. Everything that is a length of time for the player (the stretch before a log or a monster, the clear road between obstacles, how long tunnels and rails last, the run-in to the finish) is written as seconds at the road's speed, so the pace is one number and the windows the owner tuned by feel keep their length in time.
- **Effect sizes are one table of numbers** in the scene, for tuning on a television.

## Monsters and punches at this pace

Found in play at the new speed, and decided by the owner:

- **Monsters charge.** A monster is drawn 1.7 times as far off as its place on the road, so it closes that much faster than the world and still arrives when the road says. Nothing else about it moves; this was asked for as the simplest thing that reads as coming at the player.
- **A punch must look like it lands.** It counts while the monster is seen within 10 world units, about the last third of a second, in place of the 1.15 seconds before arrival that had become "very far away" once the road was fast. An arrived monster looms for 0.12 seconds more before it strikes and can still be punched then: the owner asked for a little tolerance on the late side.
- **Raising a guard is not a punch.** The quick-forward rule fired when the player brought their fists up on seeing a monster, which knocked it away before the real punch. A punch must now also end with the arm nearly straight (shoulder to wrist at least 80% of the arm's length); a guard leaves the elbow bent. A straight arm swung up from the side still counts.

## Consequences

Slowed time before the finish changes nothing that is judged. None of the sizes or the new pace has been tried on a phone and television. The view now turns and tilts by a few degrees at times, which the earlier rule "never turns" forbade; that rule is narrowed to the body's own angles.
