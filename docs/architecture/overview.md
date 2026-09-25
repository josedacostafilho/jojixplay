---
status: Active
last_verified: 2026-09-24
---

# Architecture

The static application runs entirely on a landscape phone. External screen mirroring is outside the application. No backend, pairing, transport, account or persistence exists.

## Workspace ownership

| Workspace | Owns | Public dependencies |
| --- | --- | --- |
| `apps/jojixplay` | Preact UI, permission, camera, worker, observation adapter, immersive lifecycle | SDK, movement view, Preact, MediaPipe |
| `packages/game-sdk` | Readonly named-joint input, freshness, lifecycle and shared DOM dwell | None |
| `packages/movement-view` | Static authored hand geometry and Three.js overlay | Three.js |
| `games/desenhar` | Game rules, two independent brushes, Three.js paint, controls, tests and standalone synthetic development | SDK, Three.js |
| `packages/game-dev` | Independent Vite hand asset lab | movement view |

Desenhar is the first new game, in `games/desenhar`. The application lazy-loads its public mount function with the applied player count and passes SDK frames. Its standalone development page has no camera or application dependency. Future games follow the same isolated workspace pattern; the owner chooses their rules. Workspace imports must use declared public package exports; relative escapes, deep cross-package imports, imports of application internals and game-to-game imports fail `verify:boundaries`. Root TypeScript and validation coordinate shared checks. The development lab builds without the application or camera.

The SDK contains the shared DOM hand-dwell mechanism used by host navigation and game tools. It contains no menu state, scoring, player identity, tracking vendor types, renderer or game framework. See [ADR-0024](../decisions/0024-movement-navigation.md). The base `mount(container)` contract returns `update(frame | null)` and `dispose()`. Null clears unavailable input. Desenhar takes one additional explicit mount argument: the applied one-/two-person count, which remains fixed for that run. Each experience owns and disposes its scene resources. New game requirements may add narrowly justified host interactions later; there is no unused audio or scoring service today.

## Data flow

A trusted touch starts camera acquisition and optional immersive APIs. One worker runs MediaPipe Full with the GPU delegate. Eligible camera callbacks schedule one estimate at a time. The phone normalizes camera rotation before publishing validated raw observations. The app adapter converts vendor-indexed landmarks into named independent joints for the SDK. Joints below 0.6 visibility or outside the normalized frame are absent; the rest of the body remains available.

Capture timestamps and frame epochs cross the SDK boundary. Observations older than 250 ms are unavailable. No stable person IDs exist. The camera hook also publishes committed source normalization to the host. Outside games, a full-viewport video element applies canonical rotation, mirroring and aspect-preserving cover cropping. The host projects hand anchors through the exact same cover rectangle for both the authored hand mesh and button hit tests. No hand-display smoothing or remote reach offset is applied. Missing torso/legs never block hand navigation. See [ADR-0025](../decisions/0025-camera-menu-and-authored-hands.md).

Portrait, stop, errors and unmount release camera/worker and immersive resources. Scene unmount releases animation callbacks, geometries, materials, observer and GPU context. Context startup failure is explicit; there is no Canvas or CPU fallback.

## Assets and deployment

Three.js WebGL2 is the only scene renderer. The menu bundles the MIT-licensed WebXR generic hand locally; its existing pose is baked into a static mesh with no finger animation. Blender-to-GLB is the chosen future authored-model workflow, not an implemented art pipeline or a claim that current forms were authored in Blender. Keep editable `.blend` sources alongside their game, export glTF binary with applied scale, and validate size, materials and draw calls on phones when the first authored asset exists.

Root `dist/` is the deployable app. `packages/game-dev/dist/` and `games/desenhar/dist/` are separate development artifacts and are not deployed. GitHub Actions validates before publishing `main`. See [ADR-0022](../decisions/0022-independent-3d-platform.md).
