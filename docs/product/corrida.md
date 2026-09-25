---
status: Active
last_verified: 2026-09-25
---

# Corrida dos Blocos

A single-player, first-person obstacle run for ages 4–7 with an adult nearby. An original procedural block forest supplies trees, grass, flowers, wooden barriers and a finish gate. Seven unchanged CC0 textures from Kenney’s Voxel Pack distinguish bark, wood, foliage, grass, earth, brick walls and the moving path. Their combined PNG size is 23,183 bytes; [provenance and license](../../games/corrida/assets/kenney-voxel/README.md) live with the game. The scene requests these files only on mount, uses mipmaps for distance, and releases textures and decoded images on exit. Loading blocks the start countdown; an asset failure or 20-second timeout displays an actionable error and releases the scene. Exiting aborts pending downloads. No Minecraft names, characters or assets are used. No dodging, smashing, enemies, persistence or online scoreboards exist.

## Entry and controls

Choose **Corrida dos Blocos** from the main menu. The host confirms one-person inference before mounting, including after a two-person Desenhar session. The world is already visible and stationary. **Agache para começar** with **No meio, segure por 3 segundos** invites a generous central stance (shoulder center between 12% and 88% of the camera width). Crouching continuously fills a three-second countdown. Leaving the center cancels immediately; standing or losing useful tracking for more than 120 ms cancels. A single noisy frame does not cancel a valid hold.

A bent observed knee, a compressed hip/knee configuration, or shoulder descent relative to a standing reference can establish crouching. With cropped legs, briefly standing before crouching supplies that reference. No whole-body prerequisite blocks menus or visible joints. Mostly full-body framing is recommended for this game.

Fresh wrist dwell, touch and keyboard focus activate **Pausa**, **Como jogar**, **Correr de novo** and the host's confirmed **Voltar**. Visible hand circles use the same amplified projection as hit testing: the central half of camera width and y=15–75% cover the interface. This projection is shared with host-owned race exit and confirmation controls; camera-backed menus and drawing retain their own projections. Buttons are at least 54 px high, and essential race copy is at least 20 px at supported phone sizes. Missing wrists disappear; missing leg joints do not prevent controls. Exiting abandons the run. Replay returns to the stationary entry and resets points, lives, time and movement history.

## Course and scoring

Five minutes means active running time, excluding entry, pauses and tracking recovery. The course is deterministic so scores are comparable. World speed increases continuously from 9 to 19.5 world units per second; obstacle intervals gradually shorten from almost six seconds to four. First encounters are seven seconds into each level and obstacles leave a gap before transitions.

| Level | Active time | Obstacles |
| --- | --- | --- |
| 1 | 0–60 seconds | Duck beams |
| 2 | 60–150 seconds | Duck beams and pose walls |
| 3 | 150–300 seconds | Duck beams, pose walls and jump barriers |

Each obstacle awards 100 points on success, with **Boa!** and a point pop. A miss awards no points, shows **Ops!**, and removes exactly one heart. Each level starts with three hearts, never more; reaching zero ends the entire run immediately. Level three has no further refill. Reaching the finish at 300 seconds with hearts remaining is victory. Successful runs can have different scores.

Jump evidence is accepted from two seconds before to one second after arrival. Duck evidence is accepted from one second before to 600 ms after arrival. The early jump cue says **Prepare o pulinho** and switches to **Pule!** when the accepted window opens. Evidence is consumed once per obstacle. These are deliberately forgiving action windows, not precise collision simulations.

## Pose walls

Four broad symmetric arm shapes are used: arms sideways, diagonally raised, bent elbows raised, and hands overhead. Required upper/lower arm directions allow 38 degrees of angular error. Legs are drawn when observed but are not scored for pose walls.

The yellow wall contains the target silhouette. A translucent live stick figure is attached to that same wall in its local 3D coordinates, so perspective, scale and motion remain aligned as it approaches. Observed bone directions are retargeted to common segment lengths, avoiding penalties for limb-length or distance differences. Missing joints and their incident segments disappear; they are never reconstructed. The wall becomes green after 120 ms of matching evidence. What scores is the matching state at arrival, not an earlier green preview. A missing required arm cannot pass.

## First-person movement and tracking

Only the upcoming obstacle's action moves the camera, starting when its cue appears (5.5 seconds before arrival). Ducking is ignored for camera movement during jump preparation and pose walls; jumps do not animate during duck obstacles, walls or entry. A symbolic dip-and-rise counts as a jump without leaving the floor. A small upward movement also counts after 60 ms of evidence. Accepted jumps produce one 1.8-second bounded arc, with a 1.8-second retrigger limit. Crouching eases between two fixed heights. The camera never follows raw joint coordinates and keeps a level horizon without running bob, roll or shake. Reduced motion removes UI pop animation, substitutes a static red border for the failure pulse, and reduces jump height. Essential forward motion remains. See [ADR-0028](../decisions/0028-contextual-race-actions.md).

Invalid/stale input freezes active time immediately and hides the preview. Sustained loss clears temporal evidence; recovery requires 800 ms in the generous central region before time resumes. Modals and background tabs also pause. Epoch changes reset movement evidence. Phone portrait, stop, camera failure and unmount release the host session and game resources. WebGL context loss displays an actionable return-to-menu message; there is no fallback renderer.

## Independent studio and verification

`npm run dev:race` starts the camera-free studio. Use the crouch checkbox or hold Down, click Pular or press Space, choose a pose, and simulate loss or an edge position. Pointer movement supplies one synthetic wrist for dwell controls. The studio uses the production mount and SDK frames, with no application import.

`npm test --workspace @jojixplay/corrida` exercises movement noise, partial joints, normalized poses, camera easing, countdown cancellation, timing windows, freshness, pause, life resets, full victory and different scores. Production Chromium checks the studio at 844×390 and 667×320; the app's movement-only journey covers entry from duo mode, help, pause and confirmed exit. Browser tests establish downstream behavior, not phone recognition, motion comfort, frame rate or thermals. See [phone acceptance](../engineering/pose-quality.md).
