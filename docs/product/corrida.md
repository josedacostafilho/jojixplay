---
status: Active
last_verified: 2026-10-09
---

# Corrida dos Blocos

**State: a feel prototype.** The earlier first-person run was removed. What exists is the character and its control on an empty road, for the owner to judge on a phone and television before any course is built. There are no obstacles, points, lives, levels, timer, help or pause yet. See [ADR-0034](../decisions/0034-corrida-third-person-puppet.md).

## What the player sees and does

A rounded toy-like character is seen from behind, whole from head to feet, on a road through a block forest, running away from the player. The camera sits just above its head and looks nearly level, so the road fills the bottom of the screen and runs to the horizon, and what is coming shows over the character's head and to its sides. Its arms are a quarter longer than a real body's and end in bright gloves, so a pose reads from across a room. It is the player's puppet:

- **It copies the arms.** Each arm the camera sees moves the character's arm on the same side. Because both face the same way, the player's left arm is the character's left arm on the left of the screen, as when following a teacher from behind. An arm the camera cannot see hangs.
- **It leans as the player leans.**
- **It lowers as the player crouches**, by the same share: half a crouch is half a crouch.
- **It moves across the road exactly as the player steps sideways.** It stops at the road's edge however far the player goes.

The road has three lanes with no line between them. The character slides freely; the game separately decides which lane the player counts as being in, and shows that only as a soft patch of light on the road under the character, which jumps from lane to lane. Nothing uses the lane yet.

The legs are not the player's: the camera rarely sees legs and the player is not running. They run on their own and fold in a crouch.

## Starting

There is no button and no held pose. The character already copies the player's arms while the game waits. A run begins when the player has stood for 0.8 s with both shoulders seen in the central half of the camera's view; one line of words asks them to face the camera or come to the middle until then.

At that moment the lanes are laid out around the player:

- The middle lane is where they stand.
- One lane is 1.25 of their own shoulder widths, about one comfortable step, so a child and an adult cover the road with steps of their own size.
- If three such lanes would not fit inside the camera's view with a margin, the lanes are narrowed until they do.
- Their standing shoulder height and torso length are recorded for the crouch.

The phone is assumed not to move during a run. If the camera's own orientation changes, or the player is gone for three seconds, the game waits again and lays the lanes out anew.

## How the body is read

- **Lane** comes from the hips, which stay put when the torso leans and move when the player steps. Shoulders stand in when the hips are out of view. A lane changes only when the player is clearly past its boundary (12% of a lane), so standing on a boundary does not flicker.
- **Crouch** is how far the shoulders have dropped from the standing height, as a share of the player's own torso length. A drop of 60% of the torso is a full crouch. The game counts the player as ducked from half a crouch and as standing again below 35%.
- **Lean** is the angle from hips to shoulders; without hips, the tilt of the shoulder line.
- **Arms** are the on-screen directions of upper arm and forearm. Tracking is reliable in the plane facing the camera, not in depth: arms out, up and down copy well; reaching towards the camera does not.

Every number here is a tuning parameter in one place and none has been tried on a phone.

## On screen

While running, the road is clear of words. A warning appears only when the player is lost (**Cadê você?**) or about to walk out of the camera's view (**Volte um pouco para o meio**). A small line in the corner shows the lane and crouch the game currently reads, for tuning.

**Voltar** is the only control: a button in the top corner, held for two seconds with a hand where the camera sees it, or touched. It asks no confirmation. A ring marks a hand only when it is over the button. Where pause and exit belong in the finished game is undecided.

## World and assets

The block forest is this game's first theme; the character is not part of it and is meant to stay the same when themes change. Raised earth banks, close trees and bushes line the road and say where it ends without a line. Five unchanged CC0 textures from Kenney's Voxel Pack cover the path, grass, banks, bark and leaves; [provenance and license](../../games/corrida/assets/kenney-voxel/README.md) live with the game. They are requested on mount and released on exit. The road waits for them; a failed or 20-second-late texture shows a message and leaves **Voltar** usable.

The character's look is separate from its movement: the game hands a character arm directions, lean, crouch and a running phase, and nothing else. A modelled character can replace the code-built one without the game changing.

## Agreed for the course, not built

Decided with the owner on 2026-10-09 and deliberately left out of the prototype: obstacles in one or two lanes to step around; low beams to duck; pose walls whose opening is always in the middle lane, matched with arms and torso lean, with a raised leg as an optional bonus that is never required; occasional stars collected by reaching with a hand, which cannot be failed. No jumping. Run length, what a collision costs, scoring and where pause and exit live are undecided.

## Independent studio and verification

`npm run dev:race` starts the camera-free studio. The pointer moves a synthetic person across the camera's view; switches crouch them, set arm shapes, lean the torso, make them a small distant child, or drop tracking.

`npm test --workspace @jojixplay/corrida` covers the start condition, lane layout for different body sizes and off-centre starts, lane changes and their boundary behaviour, hips against shoulders, the crouch measure, arm copying by side, the edge warning, and the run's waiting, loss and restart behaviour. Production Chromium drives the studio at two phone sizes. None of this establishes how the control feels; that is what the prototype is for. See [phone acceptance](../engineering/pose-quality.md).
