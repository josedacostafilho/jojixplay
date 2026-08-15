---
status: Active
last_verified: 2026-08-15
scope: Implemented user-visible behavior, controls, simulation, presentation, and acceptance criteria for Racing
---

# Racing game

## Intended outcome

Racing is a television-local pseudo-3D arcade race controlled entirely by body pose. Forward throttle is automatic. Drivers hold an imaginary two-handed steering wheel and tilt it left or right. One player races a deterministic point-to-point course against elapsed time; two players race the same course simultaneously through left/right split-screen views.

The phone continues to infer pose and send only validated canonical landmarks. Phaser and the complete race simulation exist only on the television. No score, identifier, input history, asset state, or camera pixel is transmitted or persisted.

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
- Ready requires one complete driver in one-player mode or two in two-player mode. A complete driver has a usable torso and both complete coarse hands; the hands do not need to be in the driving region until calibration begins.
- Start suspends dwell controls and begins a three-second calibration countdown. The countdown advances only while every required driver holds a valid wheel pose, so missing input cannot silently create a bad neutral angle.
- After calibration, automatic throttle begins immediately. The race ends at the course finish; one player receives a final time, while two players receive Left, Right, or tie results.
- Play Again and Restart return to a clean Ready state. Exit destroys the complete Phaser runtime and all transient race, calibration, lease, and gesture state.

## Camera-layout contract

| Mode | Supported camera layouts | Television presentation |
| --- | --- | --- |
| One player | Portrait and landscape | One full-screen chase view |
| Two players | Landscape only | Left and right vertical split-screen chase views |

- A two-player selection from portrait enters the existing absolute landscape request gate and mounts Racing only after acknowledgement plus a matching canonical packet.
- The Racing canvas always fills the television. Camera aspect ratio constrains pose coordinates and reachable menu targets, not the road viewport.
- Racing locks its entering camera layout. A mismatch freezes countdown, simulation time, cars, and rendering state; hides pose input; and requests return to the captured layout.
- Returning to the captured layout clears input and pause-gesture history before resuming. A prior user pause remains active rather than being silently dismissed.

## Driver assignment

- One-player mode selects the sole usable pose and labels it `Solo`.
- Two-player mode initially assigns the mirrored leftmost torso to the Left car and the rightmost torso to the Right car.
- During that mounted race, bounded nearest-torso continuity retains each television-local lease through MediaPipe array reorder and brief dropout. An uncertain or implausibly displaced observation becomes unavailable rather than being guessed.
- Leases never leave television memory and reset on camera epoch, Restart, Play Again, Exit, disconnect, or runtime destruction. They are not stable identities. Players should remain generally on their starting sides.

## Steering contract

### Valid wheel pose

A valid observation requires:

- usable shoulders and hips;
- both complete wrist/pinky/index/thumb coarse hands;
- hands separated by at least `0.55 ×` and no more than `1.8 ×` the current aspect-corrected shoulder span;
- a hand midpoint from slightly above the shoulders through the hip line; and
- both hand centers inside the canonical frame.

Mirrored hand centers are ordered by physical screen position. Their aspect-corrected line angle is the raw wheel angle, so a visually clockwise tilt steers right and a counter-clockwise tilt steers left.

### Calibration and response

- Three seconds of valid wheel input establishes one neutral angle per driver. Drivers need not remain motionless; the bounded mean of current valid samples establishes their comfortable center.
- A neutral-relative angle within `5°` produces zero steering. Steering then ramps linearly and reaches full command at `28°` from neutral.
- An `80 ms` exponential response filter reduces pose-step vibration while preserving deliberate motion. It is private to Racing and never changes canonical pose data.
- A missing wheel observation retains the last command for at most `150 ms`; continued loss marks tracking unavailable and eases command toward center.
- Phone movement after calibration is not silently compensated because adaptive recentering could absorb a deliberate sustained turn. Recenter in the pause menu performs a fresh valid-input countdown while retaining car position and elapsed race time.

## Pause interaction

- While Racing, either current driver can hold both complete hands above the corresponding shoulders for `1,000 ms` to pause.
- The gesture activates once and remains latched until all observed drivers lower at least one hand. It cannot repeatedly toggle while held.
- Pause freezes active simulation time and car state. Normal neutrally re-armed body controls then expose Resume, Recenter, Restart, and Exit inside the reachable camera projection.
- Resume keeps the existing neutral calibration. Recenter freezes the race and performs a new three-second calibration before continuing. Restart clears the result, cars, clock, calibration, and leases and returns to Ready.

## Course and movement

- The first course is authored and deterministic so one-player times and two-player conditions are comparable.
- The course contains bounded straights, left/right curves, and gentle elevation changes. It is represented by fixed-length segments and has one finish line.
- Every car receives the same automatic acceleration toward the same capped maximum speed.
- Steering moves the car laterally relative to the road. Curve drift requires an appropriate steering command to remain centered.
- Crossing the road edge applies drag and a lower effective speed ceiling; returning to the road lets automatic acceleration recover speed.
- Cars remain inside a bounded visible lateral range. They do not collide with one another, obstacles, or scenery in this version, and there is no rubber-banding.
- A `60 Hz` fixed-step accumulator owns movement. A bounded number of catch-up steps prevents a delayed browser frame from causing a simulation spiral or teleport. The displayed time is accumulated active simulation time, not animation-frame count.

## Phaser Canvas presentation

- Racing dynamically loads one `Phaser.CANVAS` runtime. No WebGL or automatic renderer selection exists.
- One-player uses one Phaser camera viewport. Two-player uses two axis-aligned camera viewports over the same immutable course and independent car states.
- Road segments render far-to-near as terrain, road, shoulders, rumble strips, and lane markings beneath a layered sky and horizon. Simple procedural roadside shapes provide speed and curve cues.
- Each viewport renders one stylized procedural car, a speed readout, progress, elapsed time, and player label. No external or borrowed image asset is required.
- The procedural body avatar is absent throughout Racing. During calibration, a prominent ghosted steering gauge explains the wheel pose. During Racing, a small translucent gauge in each outer lower corner rotates with the filtered command; two dots show current hand validity and change to a warning treatment when tracking is unavailable.
- Ready, pause, orientation, error, and result information remains semantic DOM above the canvas. Active driving has no pose cursor or ordinary target buttons.
- Reduced-motion preference removes nonessential pulsing and transition effects without changing simulation or input.

## Failure and cleanup behavior

- Phaser-load or initialization failure shows an actionable Racing error and leaves Exit available; it never falls back to another renderer.
- Start remains disabled until the selected number of complete drivers is visible and the Phaser runtime is ready.
- Calibration waits for valid wheel input rather than guessing. Tracking loss during Racing centers only the affected steering command after the grace interval; it does not pause the opponent or invent an identity.
- Disconnect, stale pose, camera epoch, orientation mismatch, user pause, viewport resize, page suspension, and unmount have explicit reset or freeze semantics and create no steering bridge.
- Runtime teardown removes Phaser cameras, canvas, callbacks, engine resources, and transient game state. Component unmount ignores any callback already queued for Phaser's final destruction frame. Re-entry creates one fresh runtime.
- Racing does not alter `PosePacket`, inference cadence, player-limit acknowledgement, transport, static deployment, or the phone runtime.

## Implementation plan

- [x] Add and pin Phaser, document it in the stack, and preserve static GitHub Pages deployment through a lazy Racing chunk.
- [x] Add strict Racing catalog/layout policy and hard-cut Games to a four-action compact left column.
- [x] Add pure driver extraction, wheel geometry, temporary side leases, epoch resets, dropout behavior, and pause-gesture latching.
- [x] Add deterministic track construction, calibration, fixed-step simulation, automatic throttle, curvature drift, off-road drag, finish timing, pause/recenter/restart, and results.
- [x] Add pure pseudo-3D projection functions and bounded viewport geometry.
- [x] Add one forced-Canvas Phaser adapter with one-/two-camera rendering, procedural cars/scenery, steering feedback, HUD, resize ownership, error handling, and complete teardown.
- [x] Integrate Ready, calibration, active race, pause, results, semantic controls, avatar omission, orientation locking, and accessible status into the television playfield.
- [x] Add unit, component, production-build, and browser-smoke regression coverage.
- [x] Reconcile architecture, product, testing, status, backlog, milestone, agent, and decision documentation with implemented truth.
- [x] Run the complete canonical validation suite and publish the validated commit.

## Acceptance criteria

1. Games exposes Draw, Bubbles, Racing, and Return through one compact left column in portrait and landscape, with no hidden prior action.
2. Racing lazy-loads one pinned Phaser Canvas runtime and never loads it on the phone, pairing, Draw, or Bubbles paths.
3. Ready requires the selected number of complete drivers, offers Start/Exit, omits the avatar, and starts no simulation before explicit activation.
4. Calibration advances for three seconds only while every driver supplies a valid two-hand wheel pose and establishes independent neutral angles.
5. Steering obeys the dead zone, full-angle clamp, response filter, dropout grace, and center-on-loss rules without mutating or globally smoothing pose packets.
6. One-player Racing supports portrait and landscape and reports active elapsed finish time. Two-player Racing requires landscape, renders left/right chase views, and declares a winner or exact tie.
7. Automatic throttle, curve drift, lateral steering, off-road speed loss, bounded lateral position, and the deterministic finish behave identically across render rates.
8. Array reorder and brief dropout do not swap two-player cars; continuity remains bounded, television-local, ephemeral, and reset at every declared boundary.
9. Active Racing renders no avatar, pose cursor, or buttons. Each viewport's restrained wheel/hand indicator exposes the command and tracking state without obscuring the road.
10. A deliberate one-second two-hands-overhead gesture pauses once; Resume, Recenter, Restart, and Exit are neutrally re-armed and have the documented state effects.
11. Orientation mismatch and page suspension freeze the complete active race without consuming time or bridging input, and returning to the captured layout respects an existing user pause.
12. Load failure and unsupported state fail clearly without a fallback renderer; Exit, cleanup, and re-entry remain reliable.
13. Automated gates prove the deterministic contracts and production chunk; real-device acceptance records television startup, sustained split-screen cadence, steering comfort/latency, pause behavior, readability, and orientation recovery.

The architecture is governed by [ADR-0016](../decisions/0016-phaser-canvas-racing.md). Shared pose, mirroring, player-limit, renderer-boundary, and camera-layout constraints remain governed by the active records in the [ADR index](../decisions/README.md).
