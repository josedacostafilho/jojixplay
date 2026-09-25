---
status: Active
last_verified: 2026-09-25
---

# Corrida dos Blocos

A single-player, first-person obstacle run for ages 4–7 with an adult nearby. An original procedural block forest supplies trees, grass, flowers, wooden barriers and a finish gate. No Minecraft names, characters or assets are used. No dodging, smashing, enemies, persistence or online scoreboards exist.

## Entry and controls

Choose **Corrida dos Blocos** from the main menu. The host confirms one-person inference before mounting, including after a two-person Desenhar session. The world is already visible and stationary. **Venha para o meio e agache para começar** invites a generous central stance (shoulder center between 12% and 88% of the camera width). Crouching continuously fills a three-second countdown. Leaving the center cancels immediately; standing or losing useful tracking for more than 120 ms cancels. A single noisy frame does not cancel a valid hold.

A bent observed knee, a compressed hip/knee configuration, or shoulder descent relative to a standing reference can establish crouching. With cropped legs, briefly standing before crouching supplies that reference. No whole-body prerequisite blocks menus or visible joints. Mostly full-body framing is recommended for this game.

Fresh wrist dwell, touch and keyboard focus activate **Pausa**, **Como jogar**, **Correr de novo** and the host's confirmed **Voltar**. Missing wrists disappear; missing leg joints do not prevent controls. Exiting abandons the run. Replay returns to the stationary entry and resets points, lives, time and movement history.

## Course and scoring

Five minutes means active running time, excluding entry, pauses and tracking recovery. The course is deterministic so scores are comparable. World speed increases continuously from 9 to 19.5 world units per second; obstacle intervals gradually shorten from almost six seconds to four. First encounters are seven seconds into each level and obstacles leave a gap before transitions.

| Level | Active time | Obstacles |
| --- | --- | --- |
| 1 | 0–60 seconds | Jump barriers |
| 2 | 60–150 seconds | Jump barriers and pose walls |
| 3 | 150–300 seconds | Jump barriers, pose walls and duck beams |

Each obstacle awards 100 points on success, with **Boa!** and a point pop. A miss awards no points, shows **Ops!**, and removes exactly one heart. Each level starts with three hearts, never more; reaching zero ends the entire run immediately. Level three has no further refill. Reaching the finish at 300 seconds with hearts remaining is victory. Successful runs can have different scores.

Jump evidence is accepted within 650 ms before or after arrival. Duck evidence is accepted from 450 ms before to 350 ms after arrival. Evidence is consumed once per obstacle. These are deliberately forgiving action windows, not precise collision simulations.

## Pose walls

Four broad symmetric arm shapes are used: arms sideways, diagonally raised, bent elbows raised, and hands overhead. Required upper/lower arm directions allow 38 degrees of angular error. Legs are drawn when observed but are not scored for pose walls.

The yellow wall contains the target silhouette. A translucent live stick figure is attached to that same wall in its local 3D coordinates, so perspective, scale and motion remain aligned as it approaches. Observed bone directions are retargeted to common segment lengths, avoiding penalties for limb-length or distance differences. Missing joints and their incident segments disappear; they are never reconstructed. The wall becomes green after 120 ms of matching evidence. What scores is the matching state at arrival, not an earlier green preview. A missing required arm cannot pass.

## First-person movement and tracking

Jumping and crouching move the camera at any point, including between obstacles. Camera height never follows raw joint coordinates. A jump needs 60 ms of upward evidence and produces one 850 ms smooth bounded arc; another jump needs a neutral stance first. Crouching eases between two fixed camera heights with posture hysteresis. The camera retains a level horizon, with no running bob, roll, shake, lateral pose steering or raw-position jitter. Reduced motion removes UI pop animation, substitutes a static red border for the failure pulse, and reduces jump height; essential forward course motion remains.

Invalid/stale input freezes active time immediately and hides the preview. Sustained loss clears temporal evidence; recovery requires 800 ms in the generous central region before time resumes. Modals and background tabs also pause. Epoch changes reset movement evidence. Phone portrait, stop, camera failure and unmount release the host session and game resources. WebGL context loss displays an actionable return-to-menu message; there is no fallback renderer.

## Independent studio and verification

`npm run dev:race` starts the camera-free studio. Use the crouch checkbox or hold Down, click Pular or press Space, choose a pose, and simulate loss or an edge position. Pointer movement supplies one synthetic wrist for dwell controls. The studio uses the production mount and SDK frames, with no application import.

`npm test --workspace @jojixplay/corrida` exercises movement noise, partial joints, normalized poses, camera easing, countdown cancellation, timing windows, freshness, pause, life resets, full victory and different scores. Production Chromium checks the studio at 844×390 and 667×320; the app's movement-only journey covers entry from duo mode, help, pause and confirmed exit. Browser tests establish downstream behavior, not phone recognition, motion comfort, frame rate or thermals. See [phone acceptance](../engineering/pose-quality.md).
