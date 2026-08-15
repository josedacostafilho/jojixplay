---
status: Active
last_verified: 2026-08-15
scope: Racing runtime, renderer selection, simulation ownership, and television compatibility
---

# ADR-0016: Add Racing through a lazy Phaser Canvas runtime

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project owner
- **Supersedes:** The no-game-engine portion of [ADR-0003](0003-client-stack-and-renderer-boundary.md) now that Racing is the concrete engine consumer, plus the portrait Games above-head placement in [ADR-0015](0015-canonical-camera-orientation.md); the typed shell, worker inference, validated pose boundary, Canvas baseline, renderer independence, and portrait Main Menu row remain active
- **Superseded by:** None

## Context

Racing is the first JojixPlay game that needs a continuous simulation loop, animated car presentation, lifecycle cleanup, and two simultaneous camera viewports. Reimplementing those generic game-runtime concerns directly in Preact and raw Canvas would create avoidable application-owned infrastructure. The accepted renderer boundary in ADR-0003 intentionally deferred an engine until a concrete game demonstrated that need.

The requested visual language is the segmented pseudo-3D road used by classic arcade racers. A general two-dimensional engine can own rendering infrastructure, but it does not supply the road projection, pose steering, or game rules. A genuine three-dimensional engine would replace that projection with meshes while raising the television requirement from Canvas 2D to WebGL 2. The current television baseline deliberately does not require WebGL.

## Decision

### Runtime boundary

- Add exact dependency `phaser@4.2.1` as the sole Racing runtime.
- Dynamically import Phaser only while Racing is mounted. Pairing, menus, Draw, Bubbles, and the phone path do not load the Racing chunk.
- Force `Phaser.CANVAS`. Do not use `AUTO`, WebGL, a runtime renderer fallback, or a second Racing renderer.
- Preact continues to own routing, semantic actions, accessibility surfaces, pose validation, camera-layout gates, and game lifecycle. One game-local adapter owns creation and complete destruction of the Phaser instance.
- Phaser owns the Racing animation callback, Canvas lifecycle, viewport cameras, game objects, procedural Graphics drawing, and frame rendering. It receives no camera pixels, MediaPipe objects, Trystero objects, or unvalidated network values.
- The application imports Phaser through one narrow `phaser-runtime` ESM/type boundary. This keeps TypeScript strict while Phaser's published declaration bundle remains incompatible with the selected TypeScript 7 compiler; blanket library-check suppression and parallel direct imports are forbidden.
- The pure TypeScript Racing domain owns rules and state. It does not depend on Phaser, Preact, browser rendering, or engine physics.

### Simulation and road

- Use one deterministic point-to-point course built from bounded fixed-length segments containing curvature and elevation. The renderer projects those segments toward a horizon and draws them far-to-near as road, shoulder, lane, terrain, and scenery geometry.
- Run race simulation through a `60 Hz` fixed-step accumulator. Bound catch-up work after a long frame; discarded wall time cannot teleport a car or inflate the race clock.
- Automatic throttle applies the same acceleration and maximum speed to every car. Steering changes lateral position; road curvature creates outward drift; leaving the road lowers the effective speed until automatic acceleration recovers it.
- Cars do not collide with each other in the first version. There is no rubber-banding, obstacle system, backend, persistence, random course, or alternate physics path.
- One-player Racing reports elapsed active simulation time at the finish. Two-player Racing renders the same course through left and right viewports and ends when the first car finishes; equal interpolated finish times produce a tie.

### Pose steering and player leases

- A driver holds two complete coarse hands in front of the torso like an imaginary steering wheel. The aspect-corrected angle of the mirrored hand line is calibrated as neutral during a three-second valid-input countdown.
- Steering has a `5°` neutral dead zone, reaches full command at `28°`, and receives an `80 ms` steering-local response filter. This does not alter `PosePacket` or the avatar's isolated presentation copy.
- Both hands must remain visibly separated and near the shoulder-to-hip driving region. A brief lost observation receives `150 ms` of grace; continued loss marks tracking unavailable and eases steering toward center.
- In two-player mode, initial mirrored left/right torso order claims the matching car. Bounded television-local nearest-torso continuity protects the temporary race leases from pose-array reordering and short dropouts. The leases reset on game exit, restart, camera epoch, or irrecoverable displacement and never become transmitted, persisted, or stable person identifiers.
- Holding both complete hands above the shoulders for `1,000 ms` requests a user pause. The gesture latches until hands leave the overhead pose. Racing exposes no dwell targets while actively driving.

### Layout and presentation

- One-player Racing accepts portrait or landscape camera input. Two-player Racing requires an acknowledged landscape camera frame.
- The camera frame defines pose input only. The Racing canvas fills the television, while actionable Ready, Paused, and Finished controls remain inside the reachable mirrored camera projection.
- Racing renders no procedural body avatar. Each viewport instead shows its car plus a restrained steering gauge and two-hand tracking state. Calibration expands that feedback; active racing reduces it to a translucent outer-corner indicator.
- The four-item Games menu uses the compact left-column layout in portrait and landscape. The three-item Main Menu retains its portrait above-head row.
- An active camera-layout mismatch withholds pose input and freezes Racing. Returning to the captured layout resumes through fresh input history. A user pause remains paused across an orientation recovery.

## Consequences

### Benefits

- Generic game-loop, camera, graphics, texture, resize, and teardown behavior comes from a maintained browser game engine.
- Canvas remains the single Racing renderer and preserves the television's existing graphics capability baseline.
- The application owns only the distinctive road projection, pose input, and deterministic race rules.
- The dynamic boundary keeps the engine out of initial pairing and non-Racing paths.
- Pure simulation and input modules remain fast and deterministic to test without Phaser or a browser.

### Costs and risks

- The Racing chunk adds download, parse, memory, and initialization cost when the game is first opened.
- Canvas support does not prove acceptable sustained split-screen performance on the owner's television; real-device acceptance is mandatory.
- Phaser camera and Graphics behavior must be verified in forced-Canvas mode rather than inferred from WebGL examples.
- A custom pseudo-3D projection is still required; the engine reduces infrastructure work rather than eliminating the game-specific renderer.
- Two-player control continuity is intentionally temporary and spatial. Large crossings or extended loss can release a car lease rather than invent identity.

## Alternatives considered

### Raw Canvas for all Racing concerns

Rejected because Racing is now a demonstrated consumer of scene lifecycle, animated game objects, resizing, and split viewports. Keeping the pure road and rules does not justify rebuilding those generic facilities.

### Phaser automatic WebGL/Canvas selection

Rejected because renderer choice would become device-dependent and expose two execution paths. The project requires one explicit, testable renderer.

### Three.js or another genuine 3D engine

Rejected for this version because it would require WebGL 2 on the television and solve a different visual problem. A future real-3D requirement may authorize a hard replacement after target-device evidence.

### Adopt an old pseudo-3D racer repository or Phaser 3 plugin

Rejected as a runtime dependency because the available examples are demonstrations or target an obsolete engine major. Their algorithms may inform the clean application-owned projection, but their code, assets, and contracts do not enter the product as a legacy path.

### Migrate Draw and Bubbles into Phaser

Rejected because they already have focused canonical renderers and do not need Racing's camera/runtime facilities. They are separate capabilities, not compatibility implementations of Racing. If a future decision selects one universal game runtime, that decision must perform a complete hard cutover.

## Verification

- Dependency and production-build inspection prove one pinned Phaser version, one lazy Racing chunk, and no Phaser import in the phone, transport, Draw, or Bubbles paths.
- Unit tests prove driver extraction, temporary slot continuity, calibration, steering boundaries, dropout behavior, pause latching, deterministic fixed-step movement, off-road speed loss, finish timing, and results.
- Projection tests prove bounded finite road geometry for one full viewport and two half viewports.
- Component tests prove Games navigation, layout gating, Ready/Starting/Racing/Paused/Finished action surfaces, avatar omission, semantic status, orientation suspension, and complete runtime teardown.
- Production-browser smoke coverage proves the Racing chunk can load and mount from the GitHub Pages asset layout without changing initial application startup.
- Real-device acceptance records first-load time, sustained one-/two-player frame cadence, Canvas memory behavior, steering latency and stability, calibration comfort, pause false positives, viewport readability, and orientation recovery on the owner's television.
