---
status: Accepted
date: 2026-10-09
---

# Corrida's rules are literal: what is drawn, at the moment it happens

Extends [ADR-0034](0034-corrida-third-person-puppet.md) after the owner's first session with obstacles on a phone and television.

## Context

The first obstacles were built with allowances for tracking lag that the owner had not asked for and rejected. A duck or a pose counted if made at any moment in a stretch of road around the obstacle, which took the challenge away. The road stopped when the camera lost the player. Poses were compared by arm angle with a 42° allowance and separate lean thresholds, none of them visible, so players passed while looking wrong and failed while looking right. The pose to make was shown on a sign above a doorway. A raised-leg bonus, suggested by the owner, proved unworkable and was withdrawn by them. All of that was replaced by rules judged at one moment against the drawn character.

Ducking also could not be done at all: the crouch was read from both shoulders together, and a deep crouch hides the shoulders.

The owner then tried the literal rules. Ducking and its timing were right. Pose walls, even as a real hole with a visible tolerance, were judged unworkable and removed, and so were stars to reach for. Jumping, dropped in ADR-0034 because a real hop was misread and is too brief to time, came back in a form the owner specified, with tunnels and rails to hang from.

## Decision

- **One moment.** A block or a beam is judged once, when it reaches the character, by what the character is doing then. Nothing earlier or later counts.
- **What is drawn is what counts.** Rules are tested against the same outline the character is drawn from. A beam is cleared when the character's head is below its underside.
- **A tunnel is a row of beams**, each judged in its turn. It is open between beams, because a solid roof would hide the character from a camera above and behind it. The first beam struck is the only one that costs.
- **Rails are held, not timed.** Over a pool, the character hangs while at least one hand is raised: above the head to take hold, down to the shoulders before it lets go. Hands may change freely. With no hand holding, at the start or part of the way, it falls in and wades the rest; it cannot climb back.
- **A jump is two things.** Anywhere on the road the character leaves the ground as far as the player does, a little amplified and never as high as a log; this counts for nothing and is there to be played with. Leaving the ground while a log is about 0.85 to 0.15 seconds ahead instead starts a set arc that lands past the log. That is the one deliberate exception to "one moment", chosen by the owner: a real hop lasts a third of a second and cannot be timed to an instant by a child through tracking lag. The stretch is not drawn.
- **A jump is every seen part rising together** above where it stood at the start of the run, by 12% of the torso's length. The part that rose least decides, so shoulders shrugged up by raised arms are not a jump, and standing up from a crouch only returns to standing height.
- **The road never waits.** A player the camera loses keeps their last lane, crouch and arms and meets whatever arrives like that. A hand that held a rail when its arm was lost goes on holding. A lost player is not taken to be in the air.
- **Crouch is read from whatever is still seen**: shoulders, nose or ears, lowest reading first, held when nothing is seen.
- **Hanging takes sideways out.** While it hangs, the character is drawn under its own lane's pair of rails.
- **No pose matching, no reaching for things, no leg poses.**

## Consequences

Outcomes can be explained by looking. Tracking lags the body by roughly a tenth of a second and the character is smoothed a little more, so a player must duck slightly ahead of a beam; that is part of the game. The rule is tested against the reading at the moment of arrival, not the smoothed drawing, so the two can differ by a few hundredths of a second of movement. A player who leaves the camera's view goes on being hit.

Standing height is measured once, at the start of a run. A player who drifts towards or away from the phone changes it, which matters more for a small hop than for a deep crouch; nothing corrects for that yet. Raised hands may leave the top of the camera's view for a tall player standing close; such an arm keeps its hold only if it was seen holding first.

The jump stretch, jump threshold, rail height and tunnel lengths are tuning parameters untried on a phone.
