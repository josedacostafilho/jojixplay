---
status: Active
last_verified: 2026-10-09
---

# Corrida dos Blocos

**State: a prototype for trying everything at once.** What exists is the view, its control, and every kind of obstacle arriving in random order on an endless road, for the owner to judge on a phone and television. There is no run length, ending, progression, help or pause yet, and what losing every heart should cost is undecided. See [ADR-0034](../decisions/0034-corrida-third-person-puppet.md) for the control and [ADR-0038](../decisions/0038-corrida-first-person-depth-and-punch.md) for the view.

## What the player sees and does

The road through a block forest is seen through the eyes of a character running down it. The player is that character: the view and the arms in it do what the player's body does, measured in the player's own body so a child and an adult get the same movement for the same effort.

- **The view moves across the road exactly as the player steps sideways**, and stops at the road's edge however far the player goes.
- **It drops as the player crouches**, by the same share: half a crouch is half a crouch, and a full one takes it under a beam with room to spare.
- **It rises as the player leaves the ground**, a little more for show. Away from a log this counts for nothing.
- **It looks level down the road and never turns.** It does not nod, and it does not roll with the player's lean: a view that rolled was tried and only shook. Leaning moves it slightly aside and forward, as a head moves on a leaning body.
- **The arms are the player's arms, in depth.** Each arm the camera sees is drawn where the player's is, upper arm and forearm each pointing the way the player's does: an arm reached towards the phone reaches down the road. The player's left arm is on the left of the screen. Arms are a quarter longer than a real body's and end in bright yellow gloves. Nothing else of the character is drawn, and the arms follow the tracked arms and nothing else, so hanging arms are out of sight.
- **A glove flashes red for a quarter of a second when its arm throws a punch.** It says what the game has read, whether or not there was anything to hit. A punch that lands on a monster also sets off a burst of stars where it stood.

The view follows slightly more slowly than the arms do, because tracking tremor moves the whole picture. A hit shakes it.

The road has three lanes with no line between them. The view slides freely; the game separately decides which lane the player counts as being in, and shows that only as a soft patch of light on the road just ahead, which jumps from lane to lane. Blocks are judged by that lane.

## Starting

There is no button and no held pose. The character already copies the player's arms while the game waits. A run begins when the player has stood for 0.8 s with both shoulders seen in the central half of the camera's view; one line of words asks them to face the camera or come to the middle until then.

At that moment the lanes are laid out around the player:

- The middle lane is where they stand.
- One lane is 1.25 of their own shoulder widths, about one comfortable step, so a child and an adult cover the road with steps of their own size.
- If three such lanes would not fit inside the camera's view with a margin, the lanes are narrowed until they do.
- The standing height of their shoulders and head and their torso length are recorded, for the crouch and the jump.

The phone is assumed not to move during a run. If the camera's own orientation changes, or the player is gone for six seconds, the game waits again and lays the lanes out anew.

## How the body is read

- **Lane** comes from the hips, which stay put when the torso leans and move when the player steps. Shoulders stand in when the hips are out of view. A lane changes only when the player is clearly past its boundary (12% of a lane), so standing on a boundary does not flicker.
- **Crouch** is how far the body has come down from its standing height, as a share of the player's own torso length; a drop of 60% of the torso is a full crouch. It is read from whichever of the shoulders, nose and ears the camera still sees, taking the lowest reading, because a deep crouch hides the shoulders behind knees and arms just when the player is lowest. Seeing none of them, the crouch stays where it last was: a player lying on the floor out of sight is still down.
- **Jump** is how far the body is above its standing height, by the same measure. Every part the camera sees must have risen, and the one that rose least decides: raised arms shrug the shoulders up but leave the head where it was, and standing up from a crouch only returns to standing height. Rising 12% of the torso's length is leaving the ground; coming back under 5% is landing.
- **Lean** is the angle from hips to shoulders; without hips, the tilt of the shoulder line.
- **Arms** are the directions of upper arm and forearm in the player's own space, from the pose model's world landmarks. Depth is the model's estimate from one camera and the least steady part, so the character follows it a little more slowly than the rest.
- **Punch** is a quick move forward, wherever the arm starts: the wrist going forward by at least 20% of its arm's own length within 260 ms, and ending at least 15% in front of its shoulder. That arm can punch again once the wrist has come back by 15% from the furthest it reached. So a jab from fists held up in front counts, an arm held out or reached out slowly does not, and nothing depends on a resting position. A first rule, a wrist simply past a fixed distance, left the gloves red nearly all the time. A reading in which the camera cannot see the whole arm tells nothing.

Every number here is a tuning parameter in one place and none has been tried on a phone.

## Obstacles

Each is recognised by what it looks like; no words announce it. They come about three seconds apart in random order, the first after about five seconds, and can be seen from far down the road.

Blocks and beams are judged at the moment they reach the character, by what the character is doing at that moment as it is drawn. Nothing done earlier or later counts. See [ADR-0035](../decisions/0035-corrida-literal-rules.md).

| Obstacle | Looks like | To clear it |
| --- | --- | --- |
| Block | Wooden crates in one or two lanes | Be in another lane. A lane is always open. |
| Beam | A wooden bar across the whole road | Have the character's head below the bar's underside, which takes a little more than half a crouch. Any lane. |
| Tunnel | Three to seven such bars in a row, 0.7 to 1.5 seconds long | Stay that low under every one. It is open between bars so the character stays in sight. |
| Log | A tree trunk lying across the whole road | Jump shortly before it. |
| Monster | A big purple creature standing in one lane, its arms across the whole road | Punch shortly before it, with the arm on its side of the road, or with either arm from its own lane. |
| Rails | A pool across the whole road, one to two seconds long, with a pair of red rails high over each lane | Have at least one hand raised from its start to its end. |

**Jumping a log.** Leaving the ground while the log is between 6 and 1 world units ahead, which is about 0.85 to 0.15 seconds before it arrives, carries the character over it in a set arc that lands just past it. A jump begun outside that stretch is an ordinary hop, which never reaches a log's height, and the character runs into the log; so does one begun too late. The stretch is not marked on the road.

**Punching a monster.** A monster cannot be stepped around: unpunched, it costs a heart wherever the player stands. A punch thrown while it is between 8 and 0.1 world units ahead (from about 1.15 seconds before it arrives until it is upon the player) knocks it up and away and wins 10 points. Its lane says which arm: the left arm for one on the left, the right arm for one on the right, either for one in the middle. A player standing in the monster's own lane has it straight ahead, and either arm will do. Where the punch lands does not matter. An arm merely held out is not a punch; the wrong arm does nothing and the right one may still follow. A punch at nothing costs nothing, like a hop.

**Hanging from rails.** A hand takes hold when it is above the character's head and lets go when it comes down to the shoulders. The character swings up and hangs by its highest holding hand, under its own lane's pair of rails, clear of the water: the view rises towards the rails, which pass just overhead, so the holding hands themselves are above it and out of sight. Hands can be changed and lowered one at a time freely. If no hand is holding, at the start or part of the way, the character drops into the pool and wades the rest of it; raising a hand again does not get it out. An arm the camera loses while it holds a rail goes on holding, drawn straight up.

**Hits.** Running into something costs one of five hearts; the view shakes and the screen's edge flashes red. When the last heart goes, all five come back with a note saying so. That is a placeholder.

**A player the camera loses.** The road does not stop. The character keeps the lane, crouch and arms it was last seen with, on the ground, and whatever arrives meets it like that. After six seconds unseen the game waits for a player again.

## On screen

Hearts and a plain count of points sit small in the top corner; what points are for is undecided. Otherwise the road is clear of words while running. A warning appears only when the player is lost (**Cadê você?**) or about to walk out of the camera's view (**Volte um pouco para o meio**). A small line in the bottom corner shows the lane, crouch, jump and each arm's reach the game currently reads, and how far and how fast the last punch went, for tuning.

**Voltar** is the only control: a button in the top corner, held for two seconds with a hand where the camera sees it, or touched. It asks no confirmation. A ring marks a hand only when it is over the button. Where pause and exit belong in the finished game is undecided.

## World and assets

The block forest is this game's first theme; the arms are not part of it and are meant to stay the same when themes change. Raised earth banks, close trees and bushes line the road and say where it ends without a line. Six unchanged CC0 textures from Kenney's Voxel Pack cover the path, grass, banks, bark and logs, leaves and wooden obstacles; [provenance and license](../../games/corrida/assets/kenney-voxel/README.md) live with the game. They are requested on mount and released on exit. The road waits for them; a failed or 20-second-late texture shows a message and leaves **Voltar** usable.

The arms' look is separate from their movement: the game hands them arm directions, lean, crouch and which arms are punching, and nothing else. Modelled arms can replace the code-built ones without the game changing.

## Undecided

How long a run is and how it ends; what points mean; what losing every heart costs; the order and pace in which obstacles should be introduced; scoring; sound; and where pause and exit live.

## Independent studio and verification

`npm run dev:race` starts the camera-free studio. The pointer moves a synthetic person across the camera's view; switches crouch them, lift them off the ground, set arm shapes, throw either arm out (Q and E), lean the torso either way, make them a small distant child, or drop tracking.

`npm test --workspace @jojixplay/corrida` covers the start condition, lane layout for different body sizes and off-centre starts, lane changes and their boundary behaviour, hips against shoulders, the crouch measure, arm copying by side, the edge warning, the run's waiting, loss and restart behaviour, the crouch reading when shoulders or everything are hidden, the jump reading against shrugs and standing up, arms and forward lean in depth, the punch reading and its pull-back, the random course, and the judging of every obstacle: blocks and beams at the moment they arrive, tunnels beam by beam, logs by where the jump began, rails by the hands that hold them, and monsters by the arm, the moment and nothing else. Production Chromium drives the studio at two phone sizes. None of this establishes how the control feels; that is what the prototype is for. See [phone acceptance](../engineering/pose-quality.md).
