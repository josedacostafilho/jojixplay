---
status: Accepted
date: 2026-10-10
---

# Corrida has maps made of levels; the first is the Amazon forest at night, built from free models

Extends [ADR-0039](0039-corrida-run-length-and-endings.md) and [ADR-0040](0040-corrida-pace-and-acting-view.md). Decided with the owner.

## Context

The block forest served to find the game's rules and feel. The owner wants the game to look far better and more professional, and to have places to go: a few maps, each one run with its own theme, made of levels that end in a boss. The first three maps are to be jungle, city and desert; only jungle is being made.

Code-built shapes cannot reach that look, and the repository is public, so nothing whose licence forbids redistribution can be used. The owner chose free model packs over paid generators or commissioned art.

## Decision

- **A map is a themed run of four levels, the last a boss.** Passing a level gives back every heart. A level is two minutes for now. Only the first level of the jungle exists, so a run ends there.
- **Jungle is the Amazon forest; its first level is deep forest at night under a full moon.** Its boss will be the Boitatá.
- **The same rules wear the forest's clothes.** Monsters are animals grown huge, one of three chosen at random with no difference in play: jaguar, anaconda, peccary. What stands in a lane is a giant stump or a boulder. What is jumped is a fallen log or roots. What is ducked is a bough, and a tunnel is a row of them. The rails are a river with caimans and piranhas, crossed by a vine: both hands hold its one end.
- **A world is a theme.** The scene keeps the rules' side of drawing (the view and its acting, the arms, when obstacles appear and go) and asks a theme for light, scenery and what each obstacle looks like. The block forest is kept as a second theme that only the developer studio can open, at the owner's wish, in case something in it is wanted again.
- **Models are free ones from Poly Pizza,** CC0 or CC-BY 3.0, credited beside the files, with textures scaled down. Everything else (ground, moon, stars, light shafts, fireflies, the rope) is made in code. Blender was not needed for this.
- **The look aimed at is stylised, not realistic:** flat-shaded models under cool moonlight from ahead with a dim fill from behind the view, mist for depth, and many copies of few models drawn together.

## Cost

The first build drew giant leafy trees and ran at 3 frames a second under the software renderer the browser tests use, against 54 for the block forest, though a laptop's graphics card held 60 either way. What cost was pixels drawn over and over: see-through leaf cards on trees scaled to fill the view. So:

- **Giants are trunks.** Only a giant's trunk is ever in sight, so only a plain trunk is drawn, and its crown is the dark canopy overhead. Leafy tree models appear at ordinary sizes only.
- **Leaves are cut out, not blended,** and every model is shaded with the matte, cheaper material.
- **The heaviest models were simplified,** and the forest is two stretches that come round, not three.
- **A slow device is asked for less:** when frames run long the scene eases the picture a step, up to four times. Each step draws it less sharply and tells the world to draw fewer of its scattered plants, crowns and far trunks, which are kept in an order that thins evenly. It is the same picture with less in it, not another way of drawing.

With these the software renderer reaches about 30 frames a second after easing. That says little about a phone, which is the thing to measure.

## After the owner's first look

The direction was right; four things were not, and were changed:

- **What is jumped and ducked looked flat and could not be told for what it was.** Stretched models of logs were replaced by trunks made in code: round, pale-barked, mossy, with cut ends and stubs. A ducked one rests on rocks at either side of the path. The three log models were dropped.
- **The forest was one rank of trees deep.** It now has three ranks of trunks into the mist and foliage from the floor up between them.
- **Nothing said there was a vine to take, and the river was a blue band.** A vine now hangs in each lane at the near bank, ending in a bright loop. The river is moving water with moonlight on it, banks, caimans that turn and piranhas that leap.
- **The boss should be glimpsed.** The Boitatá overtakes the runner along the path's edge every so often, lighting the forest as it passes. Its lamps are always in the scene and dark when it is away, because lighting a lamp only when it comes would rebuild every material at that moment.

## After the owner's second look

- **Things appeared close by.** A stretch of forest was coming round again 44 units ahead. Stretches now come back only beyond the mist, which itself begins and ends further off (118 units), and obstacles are laid further ahead than that.
- **Still thin, and no canopy.** There are three ranks of trunks, a wall of shadowy forest beyond the last, and dark masses of leaves at every height between. Rounded leaf-clumps lit from below read as floating boulders, so near crowns and the canopy over the path are the tree models' own leafy parts, hung without their trunks, and what fills the depths is the clump in deep shade. Leafy crowns are costly, so they are used only where seen close.
- **One vine.** A river has one vine over one lane, taken from that lane. This changes the rule: hands raised elsewhere find nothing.
- **Monsters come in two sizes.** The anaconda is as before. A jaguar or peccary is no wider than its lane and only strikes a player in it; it can still be punched from anywhere.
- **The Boitatá looked like a meteor.** It is now a long banded body moving in travelling waves behind a head with a jaw, eyes and tongue, with its flames as a crest so the body shows, flying beyond the first rank of trees. Its glow was first drawn through whatever leaves were in the way, which made it look laid over the screen; trunks and leaves in front now hide it like anything else.
- **A falling tree** is a new thing to step round: it comes down across two lanes as the player nears, starting three seconds ahead, and is judged as it lies.
- **Easing has four steps,** not three, for the thicker forest. The software renderer reaches about 18 frames a second after easing.
- **The patch of light that showed the counted lane is gone.** In first person the view itself is in the lane, and what stands ahead shows where to be.

## After the owner's third look

- **The falling tree is passed while it falls.** What was built first was down before the player reached it and too short to threaten the third lane. It is now tall enough to lie across the whole path, and at the moment of passing it is one straight trunk at one angle, which makes the rule literal: on the ground at its own side, a beam's height over the middle, just over a head at the far side. The middle lane therefore became passable ducked.
- **A hollow trunk** is a tunnel in one lane. Its walls cost nothing: the owner judged a heart for stepping sideways too punishing, so a step inside or beside it is ignored until its end.
- **The road is broken by gaps,** a river or a ravine, with a vine, a trunk or both across. The rails obstacle became this. Falling into a ravine never stops the road: the fall lasts as long as the ravine does.
- **The ground and scenery know where the gaps are.** The ground is one sheet that discards itself inside up to four gaps and comes level at their lips; every scattered plant and trunk whose foot stands in a gap is not drawn. A gap is then built as two shared edge strips, water or mist, and what stands on its lips. Nothing is allocated for a gap but its objects.
- **The ground does not move.** Its humps, ruts, puddles and wandering edge are worked out from the distance run, in its own shader, so one sheet serves the whole road.
- **The view is drawn into line with a trunk** for the last 0.3 seconds before its mouth, and kept within or clear of its walls. This changes no rule; without it the view passes through the wood.
- **The studio lays a named road** (`?road=7`) so one obstacle can be looked at again.

## After the owner's fourth look

- **The pace is never altered.** Passing or failing anything, the road and the view go on at the same speed; only the finish's slow stretch is allowed to change it. The hit that threw the view backwards is gone, and a mistake is told by a harder shake, a stronger red flash and the heart breaking.
- **A ravine is fallen down, not swung through.** The fall that rose again read as a vine's swing and as no punishment. It is now monotonic, the dark closes in, and the character is put back on the road past the gap, as many games do. The arc went to the vine, shallower.
- **A gap's far edge is ragged, and the rules do not know it.** The owner wanted a far wall that is not a straight line head-on, with no cost in play. So a gap has an ideal end, its edge is drawn from there to a set distance further (3 units for a ravine, 1 for a river), and every rule allows for the most: vines carry past it, trunks reach past it, falls end before the nearest and return past the furthest, and the next obstacle's clear road is counted from there. The ground, the scenery that is cleared and the wall itself all follow the same ragged line, which the ground's shader works out for itself.
- **A ravine has no floor.** A bright bottom made the road look like an island in the sky. The walls now go down 48 units into the dark.
- **Nothing restarts a run.** A run used to start over when the player was unseen for six seconds and when the camera's picture changed; the owner saw runs reset for no reason they could see. The road now goes on through any absence, and a changed picture has its lanes laid out again around where the player was.
- **The falling tree is drawn lower than its rule,** 1.2 units over the middle lane against a beam's 1.45, because at the true height it looked passable upright.

## After the owner's fifth look

- **A gap showed the forest's tricks.** Cutting the forest away across a river or a ravine opened a view sideways into it, where only the first rank of giants has crowns and the far wall is a picture. Two proposals were refused: closing the cut near the road, and building the whole forest in depth. What was agreed: the cut stays open and moonlit, and each gap plants its own facing along both banks (crowned giants leaning over it, thickets on the lip, dark leaves between the trunks), with mist in sheets at its far ends. It is a set for the cut, not a deeper forest.
- **Bark in a few dark shades.** The falling tree, and all fallen wood, had been made paler to stand out, and looked like another forest's. Every trunk and wooden prop now takes one of seven dark shades at random.
- **Nothing hangs from nothing.** The vine models hung in the air over the path are gone. Giants by the path grow limbs out over it, and lianas made in code hang from those. The vine to swing by hangs from a bough of a tree on the near bank.
- **Hurt comes when the character is hurt.** Red flash, shake and the breaking heart had fired at the lip of a gap, as if something unseen had struck. The heart itself now goes later, and the effects with it: in a ravine when the dark closes over the fall, in a river 0.4 seconds after going in, as a bite. The rule moved, not only the effect, so a run that ends on its last heart ends there too.
- **The anaconda faces the player** and slides. A world says how a monster moves (`userData.gait`), because the scene cannot know what animal it is.
- **Fungi are small.** The giant teal toadstools were no part of this forest. Blocks are stumps and boulders; the fungi are small, pale, faintly green and on litter and rotting wood.
- **More life, made in code only.** Buttress roots, orchids, termites' nests, webs, watching eyes, moths, falling leaves, bats, low mist and water lilies were added without a new model file. Leafcutter ants crossing the path were tried and removed, and so was the moss laid along the top of fallen and hollow trunks, which looked wrong on the darker bark. Folklore figures and animals that need models were left for later.

## Security policy

A model file carries its textures inside it, and the loader reads each one through a `blob:` address made by the page itself. The app's content security policy allowed connections only to its own origin, which refused them: the forest loaded without its textures in the app while the studio, which has no such policy, looked right. The policy now allows `blob:` for connections. A blob address can only name data the page itself already holds, so this opens no way out to the network. The real-browser journey now fails if the policy refuses anything while the game opens.

## Consequences

This is a look test, to be judged on a television and measured on the phone before the level is designed further. Its cost on the phone has not been measured, beside the pose model on the same graphics chip. Animals do not move their limbs; the models are not rigged. Which way each animal model faces was set by eye from stills and may be wrong for one of them. City and desert are not shown anywhere yet, levels two to four and the boss do not exist, and hearts are not yet given back between levels because there is only one. CC-BY credit is given in the repository; the app itself shows no credits screen yet.
