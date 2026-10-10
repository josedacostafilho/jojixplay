---
status: Active
last_verified: 2026-10-09
---

# Corrida dos Blocos

**State: a prototype for trying everything at once.** What exists is the view, its control, and every kind of obstacle arriving in random order on a two-minute road with a finish line, through the first look of the night jungle ([ADR-0041](../decisions/0041-corrida-maps-and-the-night-jungle.md)), for the owner to judge on a phone and television. While it is being tried out hearts that run out come back; there is no progression, help or pause yet. See [ADR-0034](../decisions/0034-corrida-third-person-puppet.md) for the control and [ADR-0038](../decisions/0038-corrida-first-person-depth-and-punch.md) for the view.

## What the player sees and does

The path through the Amazon forest at night is seen through the eyes of a character running down it. The player is that character: the view and the arms in it do what the player's body does, measured in the player's own body so a child and an adult get the same movement for the same effort.

- **The view moves across the road exactly as the player steps sideways**, and stops at the road's edge however far the player goes.
- **It drops as the player crouches**, by the same share: half a crouch is half a crouch, and a full one takes it under a beam with room to spare.
- **It rises as the player leaves the ground**, a little more for show. Away from a log this counts for nothing.
- **It looks level down the road and does not turn with the player's body.** It does not nod, and it does not roll with the player's lean: a view that rolled was tried and only shook. Leaning moves it slightly aside and forward, as a head moves on a leaning body.
- **The arms are the player's arms, in depth.** Each arm the camera sees is drawn where the player's is, upper arm and forearm each pointing the way the player's does: an arm reached towards the phone reaches down the road. The player's left arm is on the left of the screen. Arms are a quarter longer than a real body's and end in bright yellow gloves. Nothing else of the character is drawn, and the arms follow the tracked arms and nothing else, so hanging arms are out of sight.
- **A glove flashes red for a quarter of a second when its arm throws a punch.** It says what the game has read, whether or not there was anything to hit. A punch that lands on a monster also sets off a burst of stars where it stood.

The view follows slightly more slowly than the arms do, because tracking tremor moves the whole picture.

**The view also acts out what happens.** Each of these is set off by the game at a moment it chooses and eased in and out; none follows the body directly, which is why they do not shake ([ADR-0040](../decisions/0040-corrida-pace-and-acting-view.md)):

| When | The view |
| --- | --- |
| Running | Bobs a little with each stride, and stops bobbing in the air |
| Stepping into another lane | Leans into the step, once |
| Jumping a log | Looks down at the log passing underneath, and dips on landing |
| A monster nearing | Turns towards the monster's side of the road |
| A punch landing | Lunges at the monster with a jolt and a pulled-in picture |
| Hanging from rails | Draws back, looks up at the hands and swings a little |
| Falling into a river | Pitches down at the water, then bobs and sways while wading |
| Falling into a ravine | Pitches down and shudders as the wall goes by, with the dark closing in from the edges; then it is back on the road, dropping onto it |
| Swinging on a vine | Looks down into the swing and up out of it |
| A falling tree landing just behind | Drops and shakes once |
| Running into something | Is shaken hard and knocked down a little; this takes over from the others |
| Coming up to the finish | Slows time and lifts to take in the banner |

The road has three lanes with no line between them. The view slides freely; the game separately decides which lane the player counts as being in, and draws nothing for it: what stands ahead shows where to be. Blocks are judged by that lane.

## Starting

There is no button and no held pose. The character already copies the player's arms while the game waits. A run begins when the player has stood for 0.8 s with both shoulders seen in the central half of the camera's view; one line of words asks them to face the camera or come to the middle until then.

At that moment the lanes are laid out around the player:

- The middle lane is where they stand.
- One lane is 1.25 of their own shoulder widths, about one comfortable step, so a child and an adult cover the road with steps of their own size.
- If three such lanes would not fit inside the camera's view with a margin, the lanes are narrowed until they do.
- The standing height of their shoulders and head and their torso length are recorded, for the crouch and the jump.

The phone is assumed not to move during a run. If the camera's picture changes under a run, the lanes are laid out again in the new one around where the player was, a new reader taking over from the old; the run goes on. Before a run it only starts the wait again.

## How the body is read

- **Lane** comes from the hips, which stay put when the torso leans and move when the player steps. Shoulders stand in when the hips are out of view. A lane changes only when the player is clearly past its boundary (12% of a lane), so standing on a boundary does not flicker.
- **Crouch** is how far the body has come down from its standing height, as a share of the player's own torso length; a drop of 60% of the torso is a full crouch. It is read from whichever of the shoulders, nose and ears the camera still sees, taking the lowest reading, because a deep crouch hides the shoulders behind knees and arms just when the player is lowest. Seeing none of them, the crouch stays where it last was: a player lying on the floor out of sight is still down.
- **Jump** is how far the body is above its standing height, by the same measure. Every part the camera sees must have risen, and the one that rose least decides: raised arms shrug the shoulders up but leave the head where it was, and standing up from a crouch only returns to standing height. Rising 12% of the torso's length is leaving the ground; coming back under 5% is landing.
- **Lean** is the angle from hips to shoulders; without hips, the tilt of the shoulder line.
- **Arms** are the directions of upper arm and forearm in the player's own space, from the pose model's world landmarks. Depth is the model's estimate from one camera and the least steady part, so the character follows it a little more slowly than the rest.
- **Punch** is a quick move forward, wherever the arm starts: the wrist going forward by at least 20% of its arm's own length within 260 ms, and ending at least 15% in front of its shoulder with the arm nearly straight: shoulder to wrist at least 80% of the arm's length. Raising the fists into a guard also moves the wrists forward, but leaves the elbows bent, so it is getting ready and not a punch; the jab thrown from the guard is the punch. That arm can punch again once the wrist has come back by 15% from the furthest it reached. So a jab from fists held up in front counts, an arm held out or reached out slowly does not, and nothing depends on a resting position. A first rule, a wrist simply past a fixed distance, left the gloves red nearly all the time. A reading in which the camera cannot see the whole arm tells nothing.

Every number here is a tuning parameter in one place and none has been tried on a phone.

## Obstacles

Each is recognised by what it looks like; no words announce it. The road runs at 16 world units a second, and every length of time below is written in the code as seconds at that speed, so the pace is one number. They come about a second and a half apart in random order (1.4 to 1.9 seconds of clear road after each), the first after three seconds, and can be seen from far down the road.

Blocks and beams are judged at the moment they reach the character, by what the character is doing at that moment as it is drawn. Nothing done earlier or later counts. See [ADR-0035](../decisions/0035-corrida-literal-rules.md).

| Obstacle | Looks like | To clear it |
| --- | --- | --- |
| Block | A giant stump or a boulder in one or two lanes | Be in another lane. A lane is always open. |
| Falling tree | A dead giant at one edge of the path, tall enough to lie right across it, that comes down as the player nears and is still coming down as they pass | Be in the far lane, or ducked in the middle one. The lane on the side it falls from is closed. |
| Hollow trunk | A great hollow trunk lying along one lane, 0.8 to 2.5 seconds long | Be in another lane, or go through it ducked from its mouth to its end. |
| Beam | A fallen tree lodged across the whole path on rocks at either side | Have the character's head below the bar's underside, which takes a little more than half a crouch. Any lane. |
| Tunnel | Four to ten such trees in a row, half a second to a second and a half long | Stay that low under every one. It is open between bars so the character stays in sight. |
| Log | A great trunk lying across the whole path, or a ridge of rocks | Jump shortly before it. |
| Monster | Great: an anaconda as long as the path is wide. Small: a jaguar or a peccary, no wider than its lane. Either charges down one lane | Punch shortly before it, with the arm on its side of the road, or with either arm from its own lane. |
| Gap | The ground broken right across: a river in its channel (1.25 to 1.85 seconds long) or a ravine (1 to 3 seconds). Over it a vine hanging over one lane, ending in a loop that catches the light, or a hollow trunk bridging one lane, or one of each over different lanes | By the vine: be in its lane with a hand raised as the gap starts, and keep at least one raised to its end. By the trunk: be in its lane and ducked from its mouth to its end. |

**Jumping a log.** Leaving the ground while the log is between 0.85 and 0.15 seconds ahead carries the character over it in a set arc that lands just past it. A jump begun outside that stretch is an ordinary hop, which never reaches a log's height, and the character runs into the log; so does one begun too late. The stretch is not marked on the road.

**Punching a monster.** A great monster cannot be stepped around: unpunched, it costs a heart wherever the player stands. A small one costs a heart only to a player in its own lane; from another lane it simply goes by, and can still be punched for points. It comes at the player: it is drawn 1.7 times as far off as its place on the road, so it closes 1.7 times as fast as everything else, and arrives when the road says. A jaguar or a peccary comes bounding; the anaconda comes head first with its length trailing up the road behind it, keeps to the ground and weaves from side to side. A punch thrown while it is seen within 10 world units, which is about the last third of a second, knocks it up and away and wins 10 points; one thrown at a monster still down the road hits nothing. A monster that arrives unpunched looms in front of the view for a further 0.12 seconds before it strikes, and a punch in that moment still knocks it away. Its lane says which arm: the left arm for one on the left, the right arm for one on the right, either for one in the middle. A player standing in the monster's own lane has it straight ahead, and either arm will do. Where the punch lands does not matter. An arm merely held out is not a punch; the wrong arm does nothing and the right one may still follow. A punch at nothing costs nothing, like a hop.

**A falling tree** stands at one edge of the path, swaying and then shuddering, and starts to go 3 seconds before the player reaches it: slowly, then faster, shedding leaves. It is tall enough to lie across all three lanes and into the trees beyond, and it is still coming down as the player passes: it reaches the ground a quarter of a second behind them, and the ground jumps. At the moment of passing it is one straight trunk rising from its foot, so it is on the ground over the lane on the side it falls from, where a beam's underside is over the middle lane, and just over a standing head in the far lane. That is the rule: the near lane costs a heart, the middle lane costs one unless the head is ducked as for a beam, the far lane is clear. It is drawn a little lower than that over the middle lane, 1.2 units, so that nobody thinks to pass under it upright. A jump changes nothing. Its boughs and crown are all at its top, which comes down beyond the path.

**A hollow trunk** is gone into at its mouth, from its own lane, with the head ducked as for a beam; a hop does not count there. A head held up at the mouth, or lifted anywhere inside, strikes it: the trunk bursts into its staves, a heart goes, and the run carries on in the open. Its walls are walls for nothing: a player inside who steps aside stays inside, a player beside it who steps at it stays beside it, and neither costs anything. Past its end the character is in whatever lane the player stands in. For the last 0.3 seconds before its mouth the view is drawn into line with it, or clear of it, so it is not seen passing through the wood.

**Gaps.** A river and a ravine are the same thing to the rules. Whoever is neither holding the vine nor inside the trunk as the gap starts, or stops being so part of the way, is in it for the rest of the way across, for one heart. The heart goes when the character is hurt, not when the mistake is made: stepping off an edge costs nothing by itself. In a river the character goes down the bank with a great splash, wades, and is up again by where the far bank may first be; 0.4 seconds after it goes in, or at the far bank if that comes sooner, what lives in the water bites, and that is when the heart breaks and the view shakes and flashes red. In a ravine it falls, faster and faster and never back up, as far as 26 units, with the dark closing in; one unit short of where the far wall may first be it is gone from sight, and that is when it strikes the bottom unseen and the heart goes; it is put back above the road beyond the gap and drops onto it. A character that struck a trunk bridge has already paid for it and pays nothing more for the fall. On a run where hearts do not come back, the last heart ends the run at the bite or the impact. The road never stops.

**The far edge of a gap is ragged, and nothing depends on where it is.** A gap is said to end where its far edge may first be. The edge is drawn anywhere from there to 3 units further on for a ravine and 1 for a river, in long uneven bites across the road, and much further both ways out in the forest. Everything allows for the most: a vine must be held as far as the gap is said to go and then carries the character on by itself to 0.3 units past the furthest the edge can be; a trunk reaches that far and further, so both its ends rest on ground, and must be ducked through to its real end; a fall ends before the nearest the wall can be and comes back past the furthest. The clear road before the next obstacle is counted from there. The near edge is straight.

**The pace never changes.** Nothing that happens to the character holds the road back or the view with it, except the slow last stretch before the finish. A mistake is told by the red flash, the breaking heart and the shake, and by what the mistake itself looks like. A trunk that is struck over a gap bursts like any other, and the character falls from there. A gap's forest is cut through with it: nothing stands in a river or over a ravine, and the moon comes down into the cut.

**Hanging from a vine.** The vine hangs over one lane, chosen by chance, and is taken from that lane as the gap starts; hands raised anywhere else find nothing. Once taken it carries the character whatever the player's feet then do. A hand takes hold when it is above the character's head and lets go when it comes down to the shoulders. The character swings up and hangs by its highest holding hand, under its own lane's pair of rails, clear of the water. While it hangs, the view draws back a little and tilts up, so the hands on the rails are in sight; it comes level again at the far side. Hands can be changed and lowered one at a time freely. If no hand is holding, at the start or part of the way, the character goes into the gap for the rest of it; raising a hand again does not get it out. An arm the camera loses while it holds a rail goes on holding, drawn straight up.

**Hits.** Running into something costs one of five hearts; the view shakes and the screen's edge flashes red. When the last heart goes the run is failed. While the game is being tried out that is switched off: all five hearts come back with a note saying so, and the run goes on.

**A player the camera loses.** The road does not stop, however long. The character keeps the lane, crouch and arms it was last seen with, on the ground, and whatever arrives meets it like that. Nothing takes a run away from a player: if the camera's picture changes under a run (its size or the screen's turn), the lanes are laid out again in the new picture around where the player was, and the run goes on.

## How a run ends

A run is one level, two minutes of road, 1920 world units, ending at a chequered banner; the last three seconds before it are clear. Crossing it stops the road and shows **Você chegou!** with **Correr de novo** and **Sair**. A run whose last heart goes stops the same way with **Não foi dessa vez**, **Tentar de novo** and **Sair**; while the game is being tried out that cannot happen. Each button is held for a little over a second with a hand, or touched. Starting again goes back to standing in the middle for a moment, with the same road ahead. The arms go on being the player's on these screens.

## On screen

Hearts and a plain count of points sit small in the top corner; what points are for is undecided. Otherwise the road is clear of words while running. A warning appears only when the player is lost (**Cadê você?**) or about to walk out of the camera's view (**Volte um pouco para o meio**). A small line in the bottom corner shows the lane, crouch, jump each arm's reach and how straight it is, and how far and how fast the last punch went, for tuning.

**Voltar** is the only control: a button in the top corner, held for two seconds with a hand where the camera sees it, or touched. It asks no confirmation. A ring marks a hand only when it is over the button. Where pause and exit belong in the finished game is undecided.

## World and assets

## Maps and levels

The game is to have maps, each a themed run of four levels ending in a boss; passing a level gives back every heart. Jungle, city and desert are the first three. Only the first level of the jungle exists, so a run is that level; nothing of the other maps is shown yet.

**Jungle, level one: the forest at night.** Giant trees stand close on both sides and three ranks deep into the mist. The nearest carry real leafy crowns, and more crowns meet over the path with gaps for the moon; further in, dark masses of leaves fill every height, and beyond the last rank the forest goes on as a wall of shadowy trunks and foliage. Thickets, leafy trees of ordinary size, palms and banana plants stand between the trunks, and ferns, bromeliads and broad leaves crowd the path's edge. Nothing shows through it. The mist hides everything beyond 118 world units, and the forest's stretches come round again only further off than that, so nothing is seen to appear. A full moon ahead and to the left edges everything with cool light; shafts of it slant down through gaps in the canopy; mist closes the distance; fireflies drift. Fallen trunks are round and whole: bark, a cut face at each end, broken stubs, small plants and small glowing fungi on them, so that what is to be jumped or ducked is plainly a tree.

**Bark** is dark everywhere and never quite the same twice: every trunk, standing, fallen, falling or hollow, and every stump, takes one of seven shades of it, greyer, redder or mossier than the next and none of them pale.

**Nothing floats.** The giants that line the path are always all drawn, with what they carry: buttress roots flaring from their feet, and for most of them a great limb reaching out over the path that forks and ends in leaves. Lianas hang from those limbs, never lower than 4.5 units, and loop along under them, and now and then one is slung right across the path from a giant to the one opposite. Whatever grows on a tree is taken away with it where a gap cuts the forest.

**Small life.** Bromeliads and sprays of pale orchids grow on the trunks and limbs, termites' nests cling to the bark, and a few spiders' webs catch the moon beside the path. Pairs of eyes, amber or green, watch from between the trees, low down or up in the branches, blink, and are gone. Moths flutter in the moonbeams, leaves drift down, bats cross the moon, and mist lies low in patches. Small fungi with a faint green glow grow in the leaf litter and on rotting wood. None of it touches the rules, and none of it hangs or stands where it could be taken for something to duck or step round.

**The ground** is one rough sheet: nearly level where the feet go, with two worn ruts, low humps, dark puddles that catch the moon, and a bank rising at each side into the forest floor. The path has no straight edge: trodden earth gives way to leaf litter along a line that wanders. The roughness is under a tenth of a unit in the lanes, so everything on the road stands where the rules say.

**A gap's banks.** Where a river or a ravine cuts the forest, everything rooted in the cut is taken away and the sky is open over it. So that what is seen down the cut is the forest's face and never its unfinished inside, each gap plants its own trees along both banks for 47 units to either side of the path: giants leaning out over the gap under their crowns, thickets on the lip, and dark leaves from the ground up between the trunks. Further along, the cut is lost in four sheets of mist one behind another. The vine to swing by hangs from a bough that a giant on the near bank holds out over the gap.

**The river** runs in a channel 0.9 units below the road, between banks of wet mud that slope down to it, with stones and reeds on their lips. It is dark moving water that heaves, with the moon broken into long glints on it, froth carried on the current and white along the banks; stones stand out of it, giant water lilies lie on it, a few of them in flower, caimans lie in it with their backs out, turning slowly, and piranhas leap clear and fall back. Over it both hands hold the end of one vine, which runs up into the canopy.

**The ravine** is a gorge that runs off through the forest on both sides and has no bottom to be seen: each side is a lip of earth and stone that overhangs, then broken rock in bands going down 48 units into the dark. The far wall stands in buttresses and bays; roots and creepers hang down it, dead boughs stick out of it and boulders are lodged in it, for 34 units to either side of the path, all kept close to the wall where the road is. Ferns and rocks stand on the lips.

**The hollow trunk** is an old tree, not a pipe: its girth swells and narrows along it, its section is lumpy, it spreads into roots at its far end and its mouth is broken off unevenly. It has small plants, small glowing fungi, the stumps of boughs and shelves of fungus on it. Inside it is dark and ribbed, with the far end growing and the moon coming through cracks in the roof.

**The Boitatá**, the serpent of fire that will be this map's boss, is seen in passing. First about eleven seconds into a run and then every 34 to 52 seconds, on either side, it comes from behind beyond the first rank of trees, a third of the way up the trunks, overtakes the runner and is gone into the mist ahead. It goes as a snake goes, in one wave after another down a long banded body that is bright at the neck and deep red at the tail, behind a broad head with a working jaw, white eyes and a forked tongue of flame; a crest of flames stands along its back and embers fall behind. Trunks and leaves in front of it hide it as they hide anything else, so it is seen winding behind them; its light turns the whole forest orange and reddens the mist and sky as it goes by. It touches nothing and nothing can be done to it.

The look is stylised, not realistic. A device that cannot keep the picture smooth is asked for less: when frames average longer than 34 ms the picture is eased a step, up to four times, each step drawing it less sharply and with fewer of the scattered plants, crowns and far trunks, and it stays eased for that visit. The arms are not part of any world and stay the same in all of them.

**Models.** Twenty-two free models (trees, plants, creepers, rocks, a stump, fungi and five animals) come from Poly Pizza under CC0 or CC-BY 3.0; [authors, licences and what was changed](../../games/corrida/assets/jungle/README.md) live with the files. Ground, moon, stars, light shafts, fireflies, fallen and falling trunks, the forest's far wall, the river, the vine to swing by, the Boitatá, and the roots, limbs, lianas, orchids, nests, webs, eyes, moths, leaves, bats, mist and water lilies are made in code. Models are requested when the game opens and released when it closes. The path waits for them; a failed or 30-second-late model shows a message and leaves **Voltar** usable.

**The block forest**, the world the game was first tried in, is kept as a second theme that only the developer studio opens (`?theme=blocks`), with its six [Kenney textures](../../games/corrida/assets/kenney-voxel/README.md). The app never loads it.

The arms' look is separate from their movement: the game hands them arm directions, lean, crouch and which arms are punching, and nothing else. Modelled arms can replace the code-built ones without the game changing.

## Undecided

What points mean; whether two minutes is the right length for a level, and whether the same road or a new one follows **Tentar de novo**; the order and pace in which obstacles should be introduced; scoring; sound; and where pause and exit live.

## Independent studio and verification

`npm run dev:race` starts the camera-free studio. The pointer moves a synthetic person across the camera's view; switches crouch them, lift them off the ground, set arm shapes, throw either arm out (Q and E), lean the torso either way, make them a small distant child, or drop tracking. `?seconds=20` in the studio's address shortens the run and `?mortal` lets it be failed, to reach either ending quickly.

`npm test --workspace @jojixplay/corrida` covers the start condition, lane layout for different body sizes and off-centre starts, lane changes and their boundary behaviour, hips against shoulders, the crouch measure, arm copying by side, the edge warning, the run's waiting, loss and restart behaviour, the crouch reading when shoulders or everything are hidden, the jump reading against shrugs and standing up, arms and forward lean in depth, the punch reading (quick, forward, ending straight, with a guard not counting) and its pull-back, the random course, and the judging of every obstacle: blocks and beams at the moment they arrive, tunnels beam by beam, logs by where the jump began, gaps by the hands that hold the vine and the lane it is taken from, by the hollow trunk gone through ducked, and by the river or ravine fallen into otherwise, hollow trunks on the ground and their walls, great and small monsters by the arm and the moment, a falling tree lane by lane, the finish at the run's set length with clear road before it, failing on the last heart when hearts do not come back, and starting again. Production Chromium drives the studio at two phone sizes. None of this establishes how the control feels; that is what the prototype is for. See [phone acceptance](../engineering/pose-quality.md).
