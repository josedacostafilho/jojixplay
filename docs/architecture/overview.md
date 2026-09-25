---
status: Active
last_verified: 2026-09-25
---

# Architecture

The static application runs entirely on a landscape phone. External screen mirroring is outside the application. No backend, pairing, transport, account or persistence exists.

## Workspace ownership

| Workspace | Owns | Public dependencies |
| --- | --- | --- |
| `apps/jojixplay` | Preact UI, permission, camera, worker, observation adapter, immersive lifecycle | SDK, Desenhar, Corrida, Preact, MediaPipe |
| `packages/game-sdk` | Readonly named-joint input, freshness, lifecycle and shared DOM dwell | None |
| `games/corrida` | Run rules, gesture recognition, first-person Three.js world, Preact game UI, tests and standalone synthetic development | SDK, Three.js, Preact |
| `games/desenhar` | Game rules, two independent brushes, Three.js paint, controls, tests and standalone synthetic development | SDK, Three.js |

Desenhar is the first new game, in `games/desenhar`. The application lazy-loads each game's public mount function; for Desenhar it mounts with the applied player count and passes SDK frames. Its standalone development page has no camera or application dependency. Corrida uses the same mount/update/dispose contract with confirmed one-person input; its rules and camera movement remain game-owned. Future games follow the same isolated workspace pattern; the owner chooses their rules. Workspace imports must use declared public package exports; relative escapes, deep cross-package imports, imports of application internals and game-to-game imports fail `verify:boundaries`. Root TypeScript and validation coordinate shared checks. The development lab builds without the application or camera.

The SDK contains the shared DOM hand-dwell mechanism and a bounded amplified hand projection for camera-hidden controls used by host navigation and game tools. It contains no menu state, scoring, player identity, tracking vendor types, renderer or game framework. See [ADR-0024](../decisions/0024-movement-navigation.md). Corrida and its host-owned exit controls share this amplified projection; camera-backed menus retain exact cover projection. The base `mount(container)` contract returns `update(frame | null)` and `dispose()`. Null clears unavailable input. Desenhar takes one additional explicit mount argument: the applied one-/two-person count, which remains fixed for that run. Each experience owns and disposes its scene resources. New game requirements may add narrowly justified host interactions later; there is no unused audio or scoring service today.

## Data flow

A trusted touch starts camera acquisition and optional immersive APIs. One worker runs MediaPipe Full with the GPU delegate. Eligible camera callbacks schedule one estimate at a time. The phone normalizes camera rotation before publishing validated raw observations. The app adapter converts vendor-indexed landmarks into named independent joints for the SDK. Joints below 0.6 visibility or outside the normalized frame are absent; the rest of the body remains available.

Capture timestamps and frame epochs cross the SDK boundary. Observations older than 250 ms are unavailable. No stable person IDs exist. The camera hook also publishes committed source normalization to the host. Outside games, a full-viewport video element applies canonical rotation, mirroring and aspect-preserving cover cropping. The host projects hand anchors through the exact same cover rectangle for both the DOM circle and button hit tests. A bounded index estimate positions the circle near the fingertip; no display smoothing or amplified reach is applied. Missing torso/legs never block hand navigation. See [ADR-0025](../decisions/0025-camera-menu-and-authored-hands.md).

Portrait, stop, errors and unmount release camera/worker and immersive resources. Scene unmount releases animation callbacks, geometries, materials, observer and GPU context. Context startup failure is explicit; there is no Canvas or CPU fallback.

## Assets and deployment

Three.js WebGL2 is the only scene renderer. Menus use DOM circles and load no 3D renderer. Blender-to-GLB is the chosen future authored-model workflow, not an implemented art pipeline or a claim that current forms were authored in Blender. Keep editable `.blend` sources alongside their game, export glTF binary with applied scale, and validate size, materials and draw calls on phones when the first authored asset exists.

Game assets live under their owning `games/<game>/assets/` directory. Keep only selected runtime files from third-party packs, with original licenses, source URLs and version/checksum provenance. Do not commit unused pack archives, duplicate exports or editing backups. Preserve necessary sources for our own authored art. Import asset URLs from the lazy game module and initiate loading on mount; do not preload whole game collections from the menu. Small menu thumbnails are separate from gameplay assets. Prefer fingerprinted external files for reusable image assets so the browser can cache them independently of code.

Corrida imports seven Kenney CC0 PNGs with `?no-inline`. Its scene fetches and decodes them on entry, gates play until ready, aborts pending downloads on exit, and disposes GPU textures and ImageBitmaps. Its grass map shares one decoded source across ground and bank textures. Browser HTTP caching of public static files is allowed; camera data remains transient and never persisted. The same source-owned URLs work in the host and standalone build, including GitHub Pages project paths.

Root `dist/` is the deployable app. `games/desenhar/dist/` and `games/corrida/dist/` are separate development artifacts and are not deployed. GitHub Actions validates before publishing `main`. See [ADR-0022](../decisions/0022-independent-3d-platform.md).
