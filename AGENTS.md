# Agent operating guide

## Greenfield — hard cutovers only

Backwards compatibility is forbidden unless explicitly requested by the user. Update all callers, tests and documents; delete replaced code, exports, dependencies and paths in the same change. Version control is the archive. No fallback renderers, alternate inference paths or speculative frameworks.

## Required reading

Before changing code, read relevant material in this order: [status](docs/project/status.md), [stack](docs/architecture/stack.md), [architecture](docs/architecture/overview.md), [standards](docs/engineering/standards.md), [testing](docs/engineering/testing.md), [decisions](docs/decisions/README.md). Resolve disagreements in the same change. Never document planned behavior as implemented.

## Product and architecture

The owner selects games. All old games are retired. The first new game, Desenhar, supports one or two people. All product copy is Brazilian Portuguese (pt-BR); engineering documentation and development conversation remain English. The audience is ages 4–7 with an adult nearby or playing together. Use a playful, colorful, readable interface without marketing-page scaffolding. Initial camera setup is touch operated by an adult. Every interaction after setup must also work through movement alone, including navigation, help, game controls, confirmations and exit. The phone stays across the room. See [ADR-0024](docs/decisions/0024-movement-navigation.md).

[ADR-0022](docs/decisions/0022-independent-3d-platform.md) governs the workspace cutover. Application code lives in `apps/jojixplay`; public contracts in `packages/game-sdk`. `games/desenhar` owns its rules, Three.js paint rendering, controls, tests and independent development build. Games own their rules, assets, tests and builds, and may not import the app or another game. Do not build unneeded game systems before games exist.

## Invariants

- Everything runs on the phone. TV use is external screen mirroring. No peer transport, backend, persistence or TV app.
- Landscape gates entry. Portrait unmounts the running session. Orientation lock, fullscreen and wake lock are best effort; gating is authoritative.
- Camera permission requires trusted activation. Outside games the camera fills the viewport behind all UI, using the same normalized cover projection as circle rendering and hit testing. Games choose their own presentation. See [ADR-0025](docs/decisions/0025-camera-menu-and-authored-hands.md) and [ADR-0026](docs/decisions/0026-circle-menu-pointer.md). The menu is a few small objects attached to the most central player's shoulders ([ADR-0030](docs/decisions/0030-body-anchored-menu.md)): a hanging arm must reach nothing, and no menu target is laid out against the screen except the slow session-exit corner. Hand rings use one bounded index estimate for both display and hit testing; menus render no hand meshes. Pixels and coordinates are never transmitted, recorded, persisted or logged.
- One worker owns one Full Pose GPU MediaPipe task for menus, Desenhar and Corrida; camera callbacks remain single-flight.
- Validate worker output at the receiving boundary. Reject malformed metadata, unknown shapes and invalid coordinates.
- Raw observations are unmirrored and unsmoothed in canonical upright landscape camera space. Source rotation happens exactly once. Frame epoch changes reset temporal consumers.
- Missing body parts do not invalidate other joints. The menu needs both shoulders to place itself; nothing else may require more than the joints it uses. Each joint independently meets confidence and bounds requirements. Never fabricate absent limbs or require a whole-body readiness gate.
- Array index is not identity. No persisted or transmitted person ID. Two-person rendering must not blend historical array slots.
- A session starts with one-person inference. Two-person mode is displayed only after the camera successfully applies it.
- Stale observations must disappear. Stop, error, portrait and unmount release workers, media tracks, scene resources and owned immersive state.
- Three.js WebGL2 is the only rendering path. Preact owns UI. No Canvas 2D, Phaser or renderer fallback. Future authored 3D assets use Blender-to-GLB.
- Desenhar uses explicit one-/two-person mode selected before mount. Two-person brush ownership uses separate screen-side shoulder zones, not array order. Missing or stale joints break strokes without deleting art; clear and exit require confirmation.
- Game input and lifecycle contracts stay narrow. Games own interpretation, effects and every control shown while they run, including confirmed exit; the host never reads or draws over a game's DOM. The host owns permissions and session resources. Pose frames never pass through interface state. See [ADR-0029](docs/decisions/0029-game-owned-controls-and-frame-channel.md).
- Target-phone tracking quality, heat and mirroring latency require real-device measurement; browser tests cannot establish them.

## Tests

Test distinct, observable behavior. Before keeping a test, identify the plausible defect it would catch. Remove tautological implementation assertions, duplicate coverage and scripted scenarios whose expected outcome does not follow from a product requirement. One input route is not an acceptance gate for a changed mechanic.

## Implementation and verification

Follow strict TypeScript, explicit ownership, actionable failures, keyboard accessibility and reduced motion. Read affected callers before editing. Prefer the smallest complete design. Use pinned dependencies and canonical commands from the stack document. Run proportional behavioral tests and the canonical quality suite. Defects need regression coverage; do not skip or quarantine failing tests. Update current docs, status and consequential ADRs in the same change. Review the diff for dead code, secrets, obsolete references and unrelated changes. Report exactly what was verified and remaining hardware limitations.
