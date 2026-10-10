---
status: Active
last_verified: 2026-10-09
---

# Architecture

The static application runs entirely on a landscape phone. External screen mirroring is outside the application. No backend, pairing, transport or account exists. The only thing saved on the phone is the name of the camera the adult chose ([ADR-0037](../decisions/0037-camera-chosen-by-looking.md)); nothing sensed is ever saved.

## Workspace ownership

| Workspace | Owns | Public dependencies |
| --- | --- | --- |
| `apps/jojixplay` | Preact menus, permission, camera, worker, sensing, observation adapter, frame channel, immersive lifecycle | SDK, the games, Preact, MediaPipe |
| `packages/game-sdk` | Readonly body-joint and hand-point input, kinds of sensing, freshness, camera cover mapping, mount/host contract and shared DOM dwell | None |
| `games/corrida` | Reading the body as a puppet (lanes, crouch, jump, lean, arms in depth, punches), the first-person arms and Three.js road, Preact game UI, tests and standalone synthetic development | SDK, Three.js, Preact |
| `games/desenhar` | Game rules, two independent brushes, Three.js paint, Preact game UI, tests and standalone synthetic development | SDK, Three.js, Preact |
| `games/sensores` | The owner's sensing bench: draws whatever the host senses, with no rules; tests and standalone synthetic development | SDK, Preact, Three.js |

The application keeps one registry entry per game and lazy-loads its public mount function. `mount(container, host)` returns `update(frame | null)` and `dispose()`; null clears unavailable input. Desenhar takes one further argument, the applied one-/two-person count, fixed for that run. `host` exposes `exit()`, `sense(kind)`, `showCamera(visible)` and `camera()`. A game owns every control shown while it runs, including **Voltar** and its confirmation, and calls `exit()` once the players confirm. The host renders nothing over a game and never reads a game's DOM. A game that fails to load or mount returns to the menu with a message. See [ADR-0029](../decisions/0029-game-owned-controls-and-frame-channel.md).

Workspace imports must use declared public package exports; relative escapes, deep cross-package imports, imports of application internals and game-to-game imports fail `verify:boundaries`. Root TypeScript and validation coordinate shared checks. Each game's standalone development page builds without the application or camera. Future host-mounted games follow the same pattern; the owner chooses their rules.

The SDK contains the one DOM hand-dwell controller, used by host menus and by each game for its own buttons; only one controller is active at a time. It contains no menu state, scoring, player identity, tracking vendor types, renderer or game framework. Consumers supply hand positions in viewport pixels: menus and Corrida project onto the camera cover rectangle, and Desenhar onto its paper. See [ADR-0024](../decisions/0024-movement-navigation.md). Each experience owns and disposes its scene resources; there is no unused audio or scoring service today.

## Sensing and interpretation

The host turns camera images into observations; a game decides what they mean. The SDK names the kinds of sensing, `body`, `hands` and `silhouette`: `body` gives named joints from Full Pose, each both as a place in the camera image (`bodies`) and, for the same joints, in metres from the person's own hips (`worldBodies`, which says how a body is held and never where it is; [ADR-0036](../decisions/0036-body-in-its-own-space.md)), `hands` gives up to two hands of 21 named points from the Hand Landmarker, each reported by the person's own left or right. A session senses bodies. A running game may call `host.sense("hands")`; the camera controller then stops the pose worker and starts one with the hand model, keeping the camera stream, so one model runs at a time, and starts a new frame epoch. When the game ends the host senses bodies again and the menu opens no game until that is applied. Every frame says which sensing produced it and carries both lists, one of them empty. A game types its input as `BodyFrame`, `WorldFrame`, `HandFrame` or the whole `Frame`. No gesture, press or pose recognition lives in the host or the SDK. Depth sensing is intended and not built. See [ADR-0031](../decisions/0031-host-sensing-service.md).

A silhouette is the third thing sensed: one coarse grid of person confidence over the whole camera image, everyone in view as one shape. It is the pose model's own mask, so the same frame also carries joints. On the GPU the worker reads the mask texture itself, shrunk first, because MediaPipe's own conversion of it returns zeros. `host.camera()` gives a game the live video element and its rotation so it can draw the person's own pixels through the silhouette; the picture is never delayed, so the silhouette is one inference behind it. See [ADR-0032](../decisions/0032-silhouette-trial-and-camera-pixels.md).

A game may also ask for the host's camera image behind it with `host.showCamera(true)`. The image is mirrored and covers the viewport; `cameraCover` in the SDK is that mapping, used by the menu, the backdrop and any game that draws over the image.

## Data flow

A trusted touch starts camera acquisition and optional immersive APIs. One worker at a time runs a single MediaPipe GPU task, Full Pose unless a game asked for hands. Eligible camera callbacks schedule one estimate at a time. The phone normalizes camera rotation before publishing validated raw observations. The app adapter converts vendor-indexed pose landmarks into named independent joints for the SDK. Joints below 0.6 visibility or outside the normalized frame are absent; the rest of the body remains available.

Converted frames are published on a channel rather than stored as interface state. A mounted game subscribes and is updated straight from the camera callback; the menu pointer reads the latest frame on each animation frame; the tracking note and adult diagnostics sample it at a slow interval. A pose frame never rerenders the interface.

Capture timestamps and frame epochs cross the SDK boundary. Body observations older than 250 ms are unavailable. No stable person IDs exist. The camera hook also publishes committed source normalization to the host. Outside games, and inside a game that asked for the camera image, a full-viewport video element applies canonical rotation, mirroring and aspect-preserving cover cropping. The host projects hand anchors through the exact same cover rectangle for both the DOM circle and button hit tests. A bounded index estimate positions the circle near the fingertip; no display smoothing or amplified reach is applied. Missing torso/legs never block hand navigation. See [ADR-0025](../decisions/0025-camera-menu-and-authored-hands.md).

Portrait, stop, errors and unmount release camera/worker and immersive resources. Desenhar redraws its surface only when a brush, the art, the layout or a dialog changes. Scene unmount releases animation callbacks, geometries, materials, observer and GPU context. Context startup failure is explicit; there is no Canvas or CPU fallback.

## Assets and deployment

Three.js WebGL2 is the only scene renderer. The menu is DOM positioned from the tracked shoulders and loads no 3D renderer. Blender-to-GLB is the chosen future authored-model workflow, not an implemented art pipeline or a claim that current forms were authored in Blender. Keep editable `.blend` sources alongside their game, export glTF binary with applied scale, and validate size, materials and draw calls on phones when the first authored asset exists.

Game assets live under their owning `games/<game>/assets/` directory. Keep only selected runtime files from third-party packs, with original licenses, source URLs and version/checksum provenance. Do not commit unused pack archives, duplicate exports or editing backups. Preserve necessary sources for our own authored art. Import asset URLs from the lazy game module and initiate loading on mount; do not preload whole game collections from the menu. Small menu thumbnails are separate from gameplay assets. Prefer fingerprinted external files for reusable image assets so the browser can cache them independently of code.

Corrida imports six Kenney CC0 PNGs with `?no-inline`. Its scene loads them on entry, waits for them before the road appears, and disposes its GPU textures on exit. Browser HTTP caching of public static files is allowed; camera data remains transient and never persisted. The same source-owned URLs work in the host and standalone build, including GitHub Pages project paths.

Root `dist/` is the deployable app. `games/desenhar/dist/` and `games/corrida/dist/` are separate development artifacts and are not deployed. GitHub Actions validates before publishing `main`. See [ADR-0022](../decisions/0022-independent-3d-platform.md).
