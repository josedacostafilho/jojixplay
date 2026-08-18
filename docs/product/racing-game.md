---
status: Active
last_verified: 2026-08-18
scope: Implemented user-visible behavior, controls, simulation, presentation, and acceptance criteria for Racing
---

# Racing game

## Intended outcome

Racing is a playfield-local pseudo-3D arcade race controlled entirely by body pose. Forward throttle is automatic. Drivers lean their torso left or right for proportional steering around their calibrated natural stance: a modest lean makes a modest turn, while a deliberate larger lean reaches full steering. One player races a deterministic point-to-point course against elapsed time; two players race the same course simultaneously through left/right split-screen views and can see the other car whenever it is inside their own forward camera frustum.

The phone continues to infer pose and produces only validated canonical landmarks. Phaser and the complete race simulation exist only in the mounted shared playfield: on the television in paired mode or on the same phone in local play. No score, identifier, input history, asset state, or camera pixel is transmitted or persisted.

## Navigation and lifecycle

```text
Main Menu
└── Games
    ├── Draw
    ├── Bubbles
    ├── Racing
    └── Return → Main Menu

Racing — Ready
├── Start
└── Exit → Games

Racing — Calibrating / Racing
└── No active buttons

Racing — Paused
├── Resume
├── Recenter
├── Restart
└── Exit → Games

Racing — Finished
├── Play Again
└── Exit → Games
```

- Entering Racing captures the acknowledged player count and current compatible camera layout. Player count cannot change until Exit.
- Ready requires one usable torso in one-player mode or two in two-player mode. A usable Racing torso has both shoulders and both hips; hands are irrelevant to readiness and steering.
- Start suspends dwell controls and begins a three-second calibration countdown. The countdown advances only while every required driver supplies fresh torso lean, so missing input cannot silently create a bad neutral angle.
- After calibration, automatic throttle begins immediately. The race ends at the course finish; one player receives a final time, while two players receive Left, Right, or tie results.
- Play Again and Restart return to a clean Ready state. Exit destroys the complete Phaser runtime and all transient race, calibration, lease, and gesture state.

## Camera-layout contract

| Mode | Supported camera layouts | Playfield presentation |
| --- | --- | --- |
| One player | Portrait and landscape | One full-screen chase view |
| Two players | Landscape only | Left and right vertical split-screen chase views |

- A two-player selection from portrait enters the existing absolute landscape request gate and mounts Racing only after acknowledgement plus a matching canonical packet.
- The Racing canvas always fills `BodyPlayfield`. Camera aspect ratio constrains pose coordinates and reachable menu targets, not the road viewport.
- Racing locks its entering camera layout. A mismatch freezes countdown, simulation time, cars, and rendering state; hides pose input; and requests return to the captured layout.
- Returning to the captured layout clears input and pause-gesture history before resuming. A prior user pause remains active rather than being silently dismissed.

## Driver assignment

- One-player mode selects the sole usable pose and labels it `Solo`.
- Two-player mode initially assigns the mirrored leftmost torso to the Left car and the rightmost torso to the Right car.
- During that mounted race, bounded nearest-torso continuity retains each playfield-local lease through MediaPipe array reorder and brief dropout. An uncertain or implausibly displaced observation becomes unavailable rather than being guessed.
- Leases never leave playfield memory and reset on camera epoch, Restart, Play Again, Exit, paired disconnect, local stop, or runtime destruction. They are not stable identities. Players should remain generally on their starting sides.

## Steering contract

### Valid torso lean

- A steering observation requires both shoulders and both hips. Racing mirrors their two averaged centers through the shared playfield presentation rule and applies camera-aspect correction before measuring the hip-center-to-shoulder-center angle.
- A shoulder center displaced to physical screen-right from the hip center is a positive/right lean; screen-left is negative/left. Anatomical indices and `PosePacket` are never swapped or mutated.
- Averaging the four central-body landmarks provides a deliberately coarse signal. Complete hands, wrists, elbows, face landmarks, and the avatar's stabilized display copy never feed steering.

### Calibration, mapping, and response

- Three seconds of fresh torso lean establishes one natural neutral angle per driver. Drivers stand comfortably rather than holding a special pose; the bounded mean of current samples establishes their center.
- Absolute calibrated lean at or below `3°` maps to centered steering. This exact dead zone absorbs ordinary rest jitter without quantizing deliberate movement outside it.
- Between `3°` and `15°`, steering magnitude follows a monotonic smoothstep curve from zero to full lock. The map is symmetric, continuous, and clamped at full steering from `15°` onward.
- An `80 ms` exponential response filter smooths changes in the analog target while preserving deliberate motion. It is private to Racing and never changes canonical pose data.
- A missing torso observation retains the last command for at most `150 ms`; continued loss marks tracking unavailable, clears the target, and eases steering toward center.
- Phone movement after calibration is not silently compensated because adaptive recentering could absorb a deliberate sustained turn. Recenter in the pause menu performs a fresh torso-neutral countdown while retaining car position and elapsed race time.

## Pause interaction

- While Racing, either current driver can hold both complete hands above the corresponding shoulders for `1,000 ms` to pause.
- The gesture activates once and remains latched until all observed drivers lower at least one hand. It cannot repeatedly toggle while held.
- Pause freezes active simulation time and car state. Normal neutrally re-armed body controls then expose Resume, Recenter, Restart, and Exit inside the reachable camera projection.
- Resume keeps the existing neutral calibration. Recenter freezes the race and performs a new three-second calibration before continuing. Restart clears the result, cars, clock, calibration, and leases and returns to Ready.

## Course and movement

- The first course is authored and deterministic so one-player times and two-player conditions are comparable.
- The `3,444 m` course contains 19 authored sections: a short opening straight, short recovery straights, sustained left/right sweepers, tightening turns, an S-bend, a readable chicane, and bounded elevation changes. It is represented by fixed-length segments and has one finish line.
- At maximum speed, the strongest authored curve demands less than `0.85` normalized steering under the fixed simulation constants. Full lock therefore retains recovery margin rather than becoming the nominal line-holding requirement.
- Projection inserts one explicit clipped near-road sample before the next fixed segment boundary. The nearest road trapezoid reaches past the viewport bottom, and a terrain base fills everything below the horizon, so camera/segment alignment can never expose the blue renderer background beside the car.
- Every car receives the same automatic acceleration toward the same capped maximum speed.
- Steering moves the car laterally relative to the road. Curve drift requires an appropriate steering command to remain centered.
- Crossing the road edge applies drag and a lower effective speed ceiling; returning to the road lets automatic acceleration recover speed.
- Cars remain inside a bounded visible lateral range. They do not collide with one another, obstacles, or scenery in this version, and there is no rubber-banding.
- In two-player mode, each chase camera projects the other car from the same authoritative race snapshot. Approach, overlap, passing, and just-overtaken depth remain visible; an opponent sufficiently behind that camera or beyond its forward draw distance is deliberately omitted rather than represented by a rear-view fallback.
- A `60 Hz` fixed-step accumulator owns movement. A bounded number of catch-up steps prevents a delayed browser frame from causing a simulation spiral or teleport. The displayed time is accumulated active simulation time, not animation-frame count.

## Phaser Canvas presentation

- Racing dynamically loads one `Phaser.CANVAS` runtime. No WebGL or automatic renderer selection exists.
- One-player uses one Phaser camera viewport. Two-player uses two axis-aligned camera viewports over the same immutable course and independent car states.
- Road segments render far-to-near as terrain, road, shoulders, rumble strips, and lane markings beneath a layered sky and horizon. Simple procedural roadside shapes provide speed and curve cues.
- Each viewport renders one stylized procedural car, a speed readout, progress, elapsed time, and player label. No external or borrowed image asset is required.
- The procedural body avatar is absent throughout Racing. During calibration, a prominent ghosted torso-lean gauge shows the driver's body against an upright reference. During Racing, a small translucent version in each outer lower corner follows the exact filtered analog command on a five-tick scale and changes to a warning treatment when torso tracking is unavailable.
- Each two-player viewport draws the rival in that rival's slot color and correct projected depth, so overtaking and being overtaken are visible independently in both halves.
- Ready, pause, orientation, error, and result information remains semantic DOM above the canvas. Actionable message panels sit near the top center and below the button layer, so they never obscure or visually cover reachable controls. Active driving has no pose cursor or ordinary target buttons.
- Reduced-motion preference removes nonessential pulsing and transition effects without changing simulation or input.

## Failure and cleanup behavior

- Phaser-load or initialization failure shows an actionable Racing error and leaves Exit available; it never falls back to another renderer.
- Start remains disabled until the selected number of usable torsos is visible and the Phaser runtime is ready.
- Calibration waits for fresh torso input rather than guessing. Tracking loss during Racing centers only the affected steering command after the grace interval; it does not pause the opponent or invent an identity.
- Paired disconnect, local stale pose, camera epoch, orientation mismatch, user pause, viewport resize, page suspension, local stop, and unmount have explicit reset or freeze semantics and create no steering bridge.
- Runtime teardown removes Phaser cameras, canvas, callbacks, engine resources, and transient game state. Component unmount ignores any callback already queued for Phaser's final destruction frame. Re-entry creates one fresh runtime.
- The application audio runtime, not Phaser, produces one speed-dependent engine voice per active car, off-road texture, countdown/Go, pause/resume, and finish cues. Leaving or pausing Racing removes the continuous engine voices; Phaser remains configured with no audio manager.
- Racing does not alter `PosePacket`, inference cadence, camera reconfiguration semantics, transport, static deployment, or the shared camera runtime.

## Completed implementation plan

- [x] Add and pin Phaser, document it in the stack, and preserve static GitHub Pages deployment through a lazy Racing chunk.
- [x] Add strict Racing catalog/layout policy and hard-cut Games to a four-action compact left column.
- [x] Add pure aspect-corrected torso-lean extraction, temporary side leases, epoch resets, dropout behavior, and separate pause-gesture latching.
- [x] Add deterministic track construction, calibration, fixed-step simulation, automatic throttle, curvature drift, off-road drag, finish timing, pause/recenter/restart, and results.
- [x] Add pure pseudo-3D projection functions, explicit near-road coverage, and bounded viewport geometry.
- [x] Add one forced-Canvas Phaser adapter with one-/two-camera rendering, procedural cars/scenery, torso-lean feedback, HUD, resize ownership, error handling, and complete teardown.
- [x] Integrate Ready, calibration, active race, pause, results, semantic controls, avatar omission, orientation locking, and accessible status into the shared body playfield.
- [x] Add unit, component, production-build, and browser-smoke regression coverage.
- [x] Reconcile architecture, product, testing, status, backlog, milestone, agent, and decision documentation with implemented truth.
- [x] Delete discrete steering and map calibrated lean through the exact `3°` dead zone, `15°` full-scale limit, and monotonic smoothstep magnitude.
- [x] Preserve the `80 ms` response and `150 ms` dropout grace as the only temporal steering processing and make the torso gauge display exact analog output.
- [x] Replace the mild eight-section course with the denser deterministic authored course and prove its strongest full-speed demand remains below full steering.
- [x] Render the opponent from each two-player camera and prove approach, side-by-side, overtake, behind-camera, curve, scale, depth, and forward-distance boundaries.
- [x] Run the complete canonical validation suite for the analog/course/opponent/audio hard cutover.

## Acceptance criteria

1. Games exposes Draw, Bubbles, Racing, and Return through one compact left column in portrait and landscape, with no hidden prior action.
2. Racing lazy-loads one pinned Phaser Canvas runtime only after Racing mounts; landing, pairing, paired controller, local setup, Draw, and Bubbles do not load it.
3. Ready requires the selected number of usable torsos, offers Start/Exit, omits the avatar, and starts no simulation before explicit activation.
4. Calibration advances for three seconds only while every driver supplies fresh shoulder/hip geometry and establishes an independent natural neutral angle.
5. Steering obeys the symmetric `3°` dead zone, `15°` full-scale smoothstep mapping, response filter, dropout grace, and center-on-loss rules without mutating or globally smoothing pose packets.
6. One-player Racing supports portrait and landscape and reports active elapsed finish time. Two-player Racing requires landscape, renders left/right chase views with the other car visible inside each forward frustum, and declares a winner or exact tie.
7. Automatic throttle, curve drift, lateral steering, off-road speed loss, bounded lateral position, and the deterministic finish behave identically across render rates.
8. Array reorder and brief dropout do not swap two-player cars; continuity remains bounded, playfield-local, ephemeral, and reset at every declared boundary.
9. Active Racing renders no avatar, pose cursor, or buttons. Each viewport's restrained torso-lean indicator exposes exact analog command magnitude and tracking state without obscuring the road; the nearest projected road always reaches past the bottom edge.
10. A deliberate one-second two-hands-overhead gesture pauses once; Resume, Recenter, Restart, and Exit are neutrally re-armed and have the documented state effects.
11. Orientation mismatch and page suspension freeze the complete active race without consuming time or bridging input, and returning to the captured layout respects an existing user pause.
12. Load failure and unsupported state fail clearly without a fallback renderer; Exit, cleanup, and re-entry remain reliable.
13. Ready, Paused, and Finished message panels remain near the top and below actionable controls in the stacking order.
14. Automated gates prove analog mapping, stronger-course feasibility, opponent overtake projection, deterministic contracts, continuous near-road coverage, and the production chunk; real-device acceptance records selected-playfield startup, sustained split-screen cadence, lean range/comfort/latency, opponent readability, pause behavior, sound, orientation recovery, and local inference-plus-rendering cost.

The runtime architecture is governed by [ADR-0016](../decisions/0016-phaser-canvas-racing.md); current steering, course, and opponent presentation are governed by [ADR-0019](../decisions/0019-analog-torso-racing.md); and sound is governed by [ADR-0020](../decisions/0020-app-owned-procedural-audio.md) and [Application audio](audio.md). Shared pose, mirroring, player-limit, renderer-boundary, and camera-layout constraints remain governed by the active records in the [ADR index](../decisions/README.md).
