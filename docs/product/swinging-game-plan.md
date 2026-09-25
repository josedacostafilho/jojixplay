---
status: Active plan
date: 2026-09-25
scope: Host-mounted elastic-swing prototype implemented; general cornering and art remain planned
---

# City-swinging game plan

Title and character look are to be chosen later. Keep the web theme and make the character and visual identity original, with no franchise name, logo, costume pattern, character model, audio or footage. One player, first person, landscape phone mirrored to a TV. The [reference video](https://www.youtube.com/watch?v=N0qV3wPP6i0) supplies only the sense of height, visible arms and webs, dense island city, rooftop landings and surrounding water (opening 0:00–0:56; city views near 1:40 and 2:39). Its VR head and hand tracking are not game controls here.

## Prototype available now

`npm run dev:swinging` opens the independent camera-free physics studio in the neutrally named `games/swinging` workspace. Press Space or **Começar** to run off the starting roof; hold A/D or the arm buttons to attach and release webs; press W or **Pular** for a jump pulse. The host also exposes **Protótipo de teias** in the single-player menu, with three-second crouch entry, camera arm/jump recognition, movement-operated help/replay/exit and a tracking warning that does not pause physics. The first-person Three.js view still uses plain buildings, simple arm/web placeholders and a rectangular island. One shared building map drives geometry, anchor candidates and collision. A bounded elastic pull now produces a measured drop, climb and upward-carry release on either side; a delayed shot on either side also clears an initial 90-degree corner in deterministic simulation. General city cornering, final island art and target-phone acceptance remain outstanding.

## Play loop

The player appears on a tall rooftop. Traffic-free ambient motion, clouds, water and trees continue while the player waits. A centered, continuously held crouch for three seconds starts the run, using the proven Corrida entry gesture as a starting point for game-local tuning. The character accelerates in a straight line, crosses the roof edge and drops. There is no aim, walking, wall climbing, objective, score or victory.

Raising either arm fires a web automatically toward a real building surface on that side. The real player's input is binary per arm: raised or lowered. Arm angle, wrist position and other pose detail do not aim the web or pose the rendered character. The web stays attached while that arm remains raised and releases when lowered. Left and right webs are independent and may coexist. While airborne, alternating sides changes the swing path and allows turns. A rooftop landing releases attached webs and switches to an automatic straight run in the current travel direction until the next edge. Web firing resumes after the drop, including from an arm still raised. Street, sidewalk, park ground or water contact ends the run. Replay returns to the original rooftop. Help, replay and confirmed exit remain operable by fresh hand movement, touch and keyboard.

## Controls and steering to prove first

- Classify each arm independently from its wrist and elbow relative to its shoulder. If the wrist leaves the camera view but that shoulder and elbow remain visible, use the elbow alone: clearly high means raised, clearly low means lowered, and brief ambiguous readings retain the previous state. A missing leg or opposite arm does not suppress the available arm. Raise/lower thresholds have hysteresis and a short noise grace. If an arm has too little fresh evidence, its web releases after that grace; a reacquired, stably raised arm can fire again without first being lowered. Gesture history resets on a frame-epoch change, and no stale observation can hold a web indefinitely. Arm coordinates do not aim webs or pose the rendered character.
- A raised arm searches nearby building roof edges and facades **ahead and on its side**, favoring high, visible surfaces that produce a useful arc. The selected point is fixed in world space until release. No web may attach to empty sky, water or an arbitrary invisible point. If no valid surface exists, show a brief side-specific cue and attach when one comes into range while held.
- A stretched web pulls but never pushes. The line starts shorter than the distance to its selected anchor, then spring tension and gravity create the arc. Velocity survives release; there is no constant forward thrust or automatic reeling. Left and right anchors impart different lateral pull. The camera follows horizontal travel direction smoothly with a capped turn rate, preserving a level horizon; limited pitch communicates dives and climbs. This is an assisted game swing with bounded forces and speed, not a claim of strict rope realism.
- Both held webs remain visible and physically active. Their combined pull is bounded so crossing anchors cannot produce an explosive impulse. Releasing either immediately removes its pull. Holding two unfavorable anchors may stall the player; release timing remains part of play.

Intended feel: **alternating left/right swings = travel roughly straight ahead**, as the sideways pulls average out over successive attachments. **Staying on the left longer = turn left; staying on the right longer = turn right.** Lowering both preserves the current forward momentum while gravity pulls the player down. Holding both webs briefly can balance a turn or change the arc, but two fixed anchors cannot propel the player forward indefinitely; release and attach farther ahead to continue. Paired holds should be useful, while releasing one or both remains the way out of an unfavorable pair.

The independent studio uses plain collision buildings, two keyboard/touch arm switches and a jump pulse. Behavioral tests cover balanced travel, side-directed pull, an actual descent-to-climb arc, upward release, collision sliding and a delayed shot clearing one corner on either side without facade contact. No canned full-circuit sequence is used as an acceptance gate; repeated turns across the city still need playtesting.

The owner now favors first-person Spider-Man VR games as the **swing-feel reference** over the third-person PS2 game. The [elastic-line research](../research/swinging-physics.md) informed the spring pull, while the existing automatic real-building aim and binary arm states stayed intact. The first shot now descends and climbs before release, and the player keeps the upward velocity afterward. The game does not weaken pull into a wall: an unfavorable held line may pin the player until they release it or jump away. The browser traces establish that these motions and initial turns exist, not that their timing or scale feels right on a phone. Tune those qualities, repeated cornering and camera presentation through play, without treating one scripted input sequence as a physics specification.

## Third control: jump pulse prototype

One binary, edge-triggered jump action is implemented alongside the two arm states. The detector accepts a small dip-and-rise of observed hips and shoulders, without requiring the player's feet to leave the floor. It is independent of wrist/elbow movement and inactive during entry. Missing torso evidence suppresses jump without suppressing an available arm. Its thresholds are prototype values and need target-phone tuning.

A whole-body dip, rise or small hop must not change a held web state; raising, lowering or swinging one or both arms while the torso stays put must not trigger jump. Keep three independent gesture histories, so resetting or losing jump evidence cannot reset either arm. During the three-second starting crouch, jump detection is inactive. After the run starts, require a fresh neutral stance before arming jump; every accepted dip-and-rise produces one pulse and must return to neutral before another. Tracking expiry or frame-epoch change disarms jump until fresh neutral evidence arrives.

If the body disappears, show a short pt-BR tracking warning but keep the world, gravity, collisions and camera running. After the brief input grace, treat both arms as lowered and jump as inactive; the resulting fall or loss is normal gameplay, never a tracking pause. When fresh body evidence returns, classify the observed arms again after a short stable interval. This differs intentionally from Corrida, whose tracking loss pauses its obstacle run. A missing wrist alone is not body loss and must not raise the warning while an elbow still supplies that arm's state.

The same pulse acts on whatever the player is physically connected to at that instant. Contact with a roof gives an upward impulse and ends the automatic rooftop run. Recent building-wall contact gives an impulse along the wall's outward normal. Each held, taut web gets a brief bounded tug toward its fixed anchor. Two webs share the web-tug budget, so they cannot double the impulse. Wall and web contributions combine under a cap. A jump in free air without a taut web or surface contact has no effect. Street, park ground and water contact still end the run before a jump can rescue it. Wall-contact timing and two-web feel require phone tuning.

Jumping does not release a web: lowering that arm remains the only release action. A player may tug near the bottom of an arc and lower an arm as motion begins to rise; early or late timing yields a different trajectory naturally, without a scripted penalty. A jump snapshots attached taut webs when triggered, so lowering an arm before the next simulation step still retains that tug. Gesture thresholds and impulse strengths remain provisional until phone play.

## Motion and collisions

Use a fixed simulation step with a bounded catch-up count and render interpolation; slow frames must not inject extra energy or tunnel through geometry. A capsule approximates the player. The same building footprints and heights drive visible massing, web candidates, wall collision and rooftop contact. Street/roof heights are authoritative. Swept movement catches fast impacts. Facade impacts slide and shed speed; rooftop contact enters the automatic run when descending onto a roof. There is no invisible island boundary: the city ends at the shoreline, and contact with water or ground ends play. A failure freezes the run and offers movement-accessible replay/exit.

Existing deterministic checks cover single-web drop/climb/release and a delayed 90-degree corner on both sides, balanced travel, rooftop and wall jump pulses, arm/jump separation, elbow-only hold, initial crouch, missing hips and physics continuing through body loss. Further acceptance needs repeated cornering, two-web elastic arcs, wall-plus-web behavior, mistimed tugs, frame-epoch resets and phone gestures. The phone trial must show that the controls feel responsive and fair; browser tests cannot establish that.

## City and presentation

Build one deterministic Manhattan-like island at roughly the reference's apparent scale: a street grid with visible road markings and sidewalks, dense blocks of varied heights, mostly towers, some brick/stone mid-rise buildings, several small parks, a few recognizable landmarks, and water on every side. Keep streets wide enough for swings and turns. Tune extent, block count and density against the target phone rather than committing to an arbitrary asset count.

Use Three.js WebGL2 and game-owned assets. Repeated building shells, road sections, windows and trees can be instanced; nearby detail and distant silhouettes use different mesh detail. Façades need a small consistent texture set for glass, concrete, stone and brick. Glass gets non-raytraced shine: varied window roughness/tint and one low-resolution static environment reflection containing sky and city shapes. Stone/brick windows use the same reflection treatment. A fixed daylight sun permits simple static projected building shadows. A cloud-bearing sky texture, atmospheric distance haze and subtly animated textured water avoid flat color planes. Screen resolution and draw distance may adapt to measured phone performance without changing the physics world.

Author the visible forearms, gloves and web launchers as a small Blender-to-GLB asset with editable source. Choose the original character's colors and costume later; avoid a franchise's recognizable suit styling, web-print fabric and emblems. They appear only when firing or attached. The game animates each shoulder, elbow and wrist toward its auto-selected web anchor, with a comfortable bend and camera-safe placement. The web starts at the launcher and ends at that anchor in 3D, with a brief firing extension and taut/slack presentation. The rendered arm follows game animation and swing physics, never the real player's arm pose; pose tracking supplies only the two raised/lowered states.

All borrowed runtime assets must be free to redistribute and keep source, license and checksum provenance beside selected files. Candidates to evaluate include [Kenney's CC0 commercial city kit](https://kenney.nl/assets/city-kit-commercial), [Poly Haven's CC0 daytime sky/environment assets](https://docs.polyhaven.com/en/faq) and [ambientCG's CC0 surface textures](https://ambientcg.com/view?id=WoodSiding006). These are candidates, not selected dependencies or an art-style commitment. All character and launcher art should be original, with no copied franchise assets.

## Ownership and delivery

The `games/swinging` workspace owns rules, Three.js scene, gestures, tests and independent camera-free studio. The host lazy-loads it from a provisional pt-BR menu label, confirms single-player inference, mounts it through the existing `Experience` contract and retains camera/exit ownership. No new engine, renderer fallback or physics dependency was needed.

The plain-block elastic-swing studio and host-mounted entry/control prototype are in place. Remaining slices refine cornering and swing feel, build city art/reflections/sky/water/arms/webs, then measure phone/TV performance and tune gestures and comfort. The final slice requires Galaxy S22 and iPhone play sessions with mirroring, heat and frame-time measurements. Update current architecture, stack, status and any consequential ADR only as actual implementation changes land.

## Control decisions

Alternating left and right attachments must support a roughly straight route. Holding one side longer must produce a turn toward that side. The third binary jump pulse is implemented for surface jumps and timed web tugs; its gesture and strength need phone tuning. It does not aim, fire, hold or release either web.

## Creative decisions for later

Choose an original pt-BR title and a distinct costume before building the final arm assets and menu art. The web theme stays.
