---
status: Active
last_verified: 2026-09-27
scope: Manual hand-controlled swing prototype; city art and phone acceptance remain outstanding
---

# City-swinging game

One player, first person, landscape phone mirrored externally to a TV. The prototype is provisionally named **Protótipo de teias**. Final title and original character styling remain undecided.

## Controls

The host switches from Full Pose to one GPU Hand Landmarker with two hands before mounting. There is no body tracking inside this game and no canned gesture recognition. Show two relaxed open hands, hold them comfortably still for 1.5 seconds, to start the automatic rooftop run. Crouch entry and jump/tug input are removed.

Each open hand places its crosshair directly on the mirrored index fingertip, with no gain, neutral offset, smoothing or screen-half restriction. Aim freezes when closing begins and remains fixed while closed. The rendered hand shares that screen projection, reverses camera-facing depth for a first-person view, and connects to invented arm bends. At viewport edges, the whole hand silhouette shifts inward to remain visible; a fingertip outside the camera image does not discard a still-detected hand. Actual detection loss still expires input.

Three of four non-thumb fingers must meet the curl threshold to close, or the extension threshold to open. Joint turning angles use local 3D geometry, so rigid hand rotation does not change classification. A 70 ms stable gesture interval and separate thresholds reject jitter; the thumb is forgiving. Values remain provisional pending phone measurement.

A fist fires once through its displayed crosshair. The first building surface within 150 game meters becomes a fixed world anchor. A solid green ring previews a surface; a double ring marks a held web; a reddish dashed ring marks a closed hand without an attachment. No snapping, target search or repeated firing while closed exists. A miss requires opening and closing again. Opening releases that hand’s web. Two hands operate independently. Hand motion does not reel or pull a held web.

The game associates wrist positions across frames, independent of detection array order. Tracking owns the detected observations separately from gesture recognition. Rendering reads those observations directly; unknown curl, gesture resets, replay and disabled gameplay do not hide hands. Gesture code cannot change observation ownership or reset the inference task. Close wrists do not clear detected hands. Each new result immediately updates present hands and removes omitted hands, releasing their webs. Capture age does not reject a newly delivered result. If no new result arrives for one second, the stream is considered stalled and hands/webs clear; repeating the same epoch/sequence does not refresh this deadline. Uncertain curl retains the previous grip until a recognized opening, missing hand, reset or stalled stream. Epoch changes reset gesture history. Reacquired fists must open before firing. Physics continues during tracking loss; it never waits for the camera.

Help and host exit are available only on preparation and death screens; replay appears after death. These controls and confirmations use index-fingertip dwell, touch or keyboard. Menu circles and hit testing share the game hands’ mirrored image projection and edge margins; there is no amplified wrist reach. Active rooftop running and swinging show no buttons or navigation cursors. The game reports active-run transitions to the host so its Back button and movement navigation follow the same visibility rule. Help suppresses gameplay actions while live hand observation updates and rendering continue. Host dialogs suppress gameplay input. Replay returns to the stable open-hand start.

## World and physics

The character automatically runs from the starting roof, then falls under gravity. A stretched web pulls without pushing; its initial length is 75% of anchor distance. Bounded elastic forces and capped speed preserve the existing swing simulation. Release preserves velocity. Both webs can pull at once, with a bounded combined force. Unfavorable anchors can pin or stall the player until release.

One building map defines visible blocks, ray hits and swept collisions. Walls slide and shed horizontal speed; descending roof landings release both webs and resume automatic running. Reopening is required to fire again after a landing. Ground/water contact ends the attempt. A fixed step with capped catch-up handles slow frames. General cornering and manual-aim swing feel need playtesting; tests of old automatically selected corners are retired with auto aim.

## Independent studio and verification

`npm run dev:swinging` opens a camera-free studio of the same scene and physics. Four accessible range controls aim the two crosshairs. Hold A/D or the corresponding buttons to shoot/hold; release to drop. Space or Começar starts/restarts. Synthetic studio hands are explicit development input, never a runtime tracking fallback.

Automated checks cover orientation-independent curl, noisy gestures, array reordering/crossing, close wrists, immediate omission handling, delayed inference, receipt-based stream stalls, epoch changes, hand-only entry, misses without automatic reattachment, exact surface hits, independent webs, release velocity, collisions, model switching and boundary validation. Browser checks assert no buttons/cursors during play and restored controls after death and replay. Browser journeys cover the studio and movement-only help/exit at phone viewports. These do not establish camera accuracy or comfort.

Phone acceptance: use the Galaxy S22 at the actual mirroring distance. Try sideways/upside-down hands, palm and back facing the camera, rotating a held fist, small child hands, partial occlusion, overlap and leaving/reentering frame. Verify aim reach, firing displacement, release latency, mirroring delay and sustained heat before tuning thresholds or art.

## City and presentation

Build one deterministic Manhattan-like island at roughly the reference's apparent scale: a street grid with visible road markings and sidewalks, dense blocks of varied heights, mostly towers, some brick/stone mid-rise buildings, several small parks, a few recognizable landmarks, and water on every side. Keep streets wide enough for swings and turns. Tune extent, block count and density against the target phone rather than committing to an arbitrary asset count.

Use Three.js WebGL2 and game-owned assets. Repeated building shells, road sections, windows and trees can be instanced; nearby detail and distant silhouettes use different mesh detail. Façades need a small consistent texture set for glass, concrete, stone and brick. Glass gets non-raytraced shine: varied window roughness/tint and one low-resolution static environment reflection containing sky and city shapes. Stone/brick windows use the same reflection treatment. A fixed daylight sun permits simple static projected building shadows. A cloud-bearing sky texture, atmospheric distance haze and subtly animated textured water avoid flat color planes. Screen resolution and draw distance may adapt to measured phone performance without changing the physics world.

The current hands use tracked finger segments and joints with reversed front/back depth; two virtual arm segments connect each wrist to an offscreen shoulder. Hands remain visible while aiming and holding, and disappear when input expires. These are prototype forms. Future authored gloves/arms use a game-owned Blender-to-GLB asset with editable source. Choose the original character’s colors and costume later. The arms need not reproduce real elbow or shoulder pose.

All borrowed runtime assets must be free to redistribute and keep source, license and checksum provenance beside selected files. Candidates to evaluate include [Kenney's CC0 commercial city kit](https://kenney.nl/assets/city-kit-commercial), [Poly Haven's CC0 daytime sky/environment assets](https://docs.polyhaven.com/en/faq) and [ambientCG's CC0 surface textures](https://ambientcg.com/view?id=WoodSiding006). These are candidates, not selected dependencies or an art-style commitment. All character and launcher art should be original, with no copied franchise assets.

## Ownership

`games/swinging` owns curl recognition, aiming, entry, rules, Three.js rendering, tests and the studio. The host owns permissions, capture, model switching and exit. [ADR-0029](../decisions/0029-hand-controlled-swinging.md) defines the model and SDK cutover; [ADR-0030](../decisions/0030-index-aim-and-first-person-hands.md) replaces its initial aim mapping; [ADR-0031](../decisions/0031-swinging-controls-outside-runs.md) governs navigation visibility; [ADR-0032](../decisions/0032-hand-results-and-stream-stalls.md) replaces capture-age and proximity rejection. [ADR-0033](../decisions/0033-tracking-independent-of-gestures.md) separates tracked observations and visibility from gesture recognition. [ADR-0034](../decisions/0034-index-pointers-in-teias-menus.md) aligns menu circles with the game’s index-fingertip projection. City art and final authored arms remain future work.
