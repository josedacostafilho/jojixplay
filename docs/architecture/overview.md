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
| `packages/game-sdk` | Readonly named-joint input, freshness, mount/update/dispose contract | None |
| `packages/movement-view` | Three.js diagnostic scene and decorative toy characters; visual-only smoothing | SDK, Three.js |
| `packages/game-dev` | Independent Vite input lab with synthetic partial-body and unequal-height observations | SDK, movement view |

No games exist yet. A future game will occupy its own `games/<name>` workspace, with its own assets, tests and build. The owner chooses its rules. Workspace imports must use declared public package exports; relative escapes, deep cross-package imports, application imports and game-to-game imports fail `verify:boundaries`. Root TypeScript and validation coordinate shared checks. The development lab builds without the application or camera.

The SDK intentionally contains no menus, scoring, player identity, tracking vendor types, renderer or game framework. `mount(container)` returns `update(frame | null)` and `dispose()`. Null clears unavailable input. Each experience owns and disposes its scene resources. New game requirements may add narrowly justified host interactions later; there is no unused audio or scoring service today.

## Data flow

A trusted touch starts camera acquisition and optional immersive APIs. One worker runs MediaPipe Full with the GPU delegate. Eligible camera callbacks schedule one estimate at a time. The phone normalizes camera rotation before publishing validated raw observations. The app adapter converts vendor-indexed landmarks into named independent joints for the SDK. Joints below 0.6 visibility or outside the normalized frame are absent; the rest of the body remains available.

Capture timestamps and frame epochs cross the SDK boundary. Observations older than 250 ms are unavailable. No stable person IDs exist. Presentation mirrors horizontally without mutating input. Single-person visual jitter is softened with a 20–45 ms response; large jumps, absent joints, stale gaps and epoch changes reset it. Two-person observations are not smoothed across array positions. Games will own their input processing.

Portrait, stop, errors and unmount release camera/worker and immersive resources. Scene unmount releases animation callbacks, geometries, materials, observer and GPU context. Context startup failure is explicit; there is no Canvas or CPU fallback.

## Assets and deployment

Three.js WebGL2 is the only scene renderer. Current simple toy forms use Three.js geometry. Blender-to-GLB is the chosen future authored-model workflow, not an implemented art pipeline or a claim that current forms were authored in Blender. Keep editable `.blend` sources alongside their game, export glTF binary with applied scale, and validate size, materials and draw calls on phones when the first authored asset exists.

Root `dist/` is the deployable app. `packages/game-dev/dist/` is a separate development artifact and is not deployed. GitHub Actions validates before publishing `main`. See [ADR-0022](../decisions/0022-independent-3d-platform.md).
