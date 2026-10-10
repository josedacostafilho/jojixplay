---
status: Active
last_verified: 2026-10-09
scope: Automated test strategy and release quality gates
---

# Testing strategy

## Current state

Vitest, Testing Library, Playwright, Biome, TypeScript, production building, and dependency auditing are the selected quality gates for the first slice. Exact commands live in [Stack](../architecture/stack.md).

Browser tests use one worker so software GPU inference and game rendering do not compete for the runner’s CPU budget. Freshness limits remain unchanged.

## Platform coverage

- Unit tests cover canonical orientation, packet validation, independent visible joints, freshness, fullscreen camera/hand projection across source rotations, worker GPU configuration, camera single-flight inference, player reconfiguration, bounded GPU warm-up after graph rebuilds, and resource cleanup.
- Component tests cover ending the session when the page is hidden, landscape gating, links with extra parameters, startup cancellation, camera-failure cleanup, deferred one-/two-person entry, game exit and a game that cannot open.
- Production Chromium tests cover landscape entry, real Full GPU worker output, fullscreen menu video and hidden in-game capture, no peer APIs and stop/portrait cleanup.
- Desenhar has its own isolated rules suite for solo/duo ownership, missing input, continuity, undo, handedness and bounded paint. Production browser coverage verifies both live-camera game entries and the standalone game's visible paint, tracking loss, clear cancellation and clear confirmation.
- A production browser journey injects synthetic worker observations and operates the body-anchored menu, shelf turning, solo/duo entry, palette selection, clear/exit confirmations and stop without any post-setup click. Shared dwell regression coverage verifies that a button appearing under a resting hand does not fire, that a hold survives a moment of lost tracking and is dropped after a long one, that a hand raised straight onto a button holds it, modal exclusivity, single activation, per-player control ownership and that a covered button is never chosen over the one drawn on top.
- Unit coverage checks bounded index estimation, partial-body observations and the menu reach geometry: a hanging hand touches no object, a stretched arm reaches each of the three cards and both bubbles, the whole row stays on screen, sizes stop growing near the camera, and the bubbles slide down clear of the row as the shoulders near the top. Dwell coverage includes per-button hold times and hold-to-repeat. Browser coverage checks that the menu appears only with shoulders in view and that the whole journey works by movement.
- Corrida has isolated tests for its start condition, lane layout across body sizes and off-centre starts, lane changes without flicker, hips against shoulders, the crouch measure, the jump reading against shrugged shoulders and standing up, arm copying by side and in depth, forward lean and its limits, the punch reading as a quick move forward that ends straight (a guard raised and a jab from it, a straight arm swung up, held out, reached slowly, re-armed, hidden arms, a reading taken twice), the edge warning, the run's waiting, loss and restart, the random course (every kind present, a lane always open, spacing, repeatable by seed), and the judging of each obstacle: blocks by lane, beams by being ducked at the moment they arrive, tunnels beam by beam for one heart, logs by a jump begun in the stretch before them and by no other, monsters by the arm on their side, or either arm from their own lane, thrown while they are seen within reach (too far off, wrong arm, held arm, early punch and every standing place failing), a falling tree by its three lanes (closed, passable ducked, clear), small monsters going by in another lane, a gap's vine by any raised hand with hands changing and an unseen arm keeping its hold, taken only from the vine's lane and then carried, the river waded, the ravine fallen down without ever rising and the character put back on the road beyond, the vine's dip, and its carrying the character past the gap's own end with hands lowered there but not before, a run kept through any absence and through a change of the camera's picture with the player still in their lane, a hollow trunk on the ground gone round or through ducked and struck by a head held up at its mouth or lifted inside, its walls holding a player in or out for nothing, a gap crossed through its trunk, fallen into from a struck one, and crossed either way when it has both, the course's gaps (every lane for vine and trunk, never the same one, rivers of one width and ravines and trunks of many), the direction of a lane step, the finish after the run's set time with clear road before it, failure on the last heart when hearts do not come back, starting again, the road carrying on for an unseen player, and hearts returning. Its standalone production studio is driven at two phone-sized viewports through start, lane changes, crouch, jump, punch, lean and lost tracking in the block forest, because a punch is read within a quarter of a second and the jungle's frames come slower than that when drawn by software, and once in the jungle through both endings: a shortened run to its finish and back to running, and a mortal run to its failure. The app movement-only journey also enters Corrida after duo mode and leaves by holding its one button.
- Network coverage, in the movement-only journey, confirms no Corrida model requests during menus or Desenhar, then exactly twenty-two same-origin model files on Corrida entry with nothing refused by the page's policy. The journey with the real pose model does not open Corrida: with the model and the jungle both run by software, one reading takes longer than the session allows and the session rightly ends. The studio checks that the road waits for its textures and reports one that cannot be loaded.
- Camera choice coverage: listing cameras, opening the remembered one by name and falling back to the front camera, releasing the camera in use before opening another, a new epoch after a switch, returning to the previous camera when one will not open and ending the session when neither will, camera naming by side, and the touch step holding the menu back until **Começar**. The real-browser journey passes through the step with Chromium's one fake camera; several real cameras exist only on a phone.
- Sensing coverage: pose packets rejected without exactly 33 finite world landmarks, world landmarks turned upright as directions and reported for exactly the joints the picture shows, hand packet validation at the worker boundary, named hand points and own-side reporting in the adapter, a worker started for hands building only the hand task and rotating its landmarks, the estimator accepting hand results, and the camera controller replacing the worker between frames, in request order, on the same camera stream, with a new epoch and a session-ending failure. A component test checks that a game's sensing and camera-image requests reach the camera and that the menu waits for bodies after a game. The bench has its own suite for mirrored projection, partial bodies, the three views of a body in its own space, both hands and its fingertip pointers. One production browser journey loads the real pose and hand models in turn on the test camera; another injects synthetic observations and operates the bench by movement in body mode and in hand mode.
- Silhouette coverage: grid validation and buffer hand-over at the worker boundary, turning a grid upright consistently with landmarks, the worker reading GPU mask textures itself, merging several people and restoring the drawing context's bindings, and the bench's coverage-based button pointer. The real-model browser journey senses a silhouette; the synthetic journey operates the bench by covering buttons with one. Mask drawing is checked by eye, not by pixel assertions.
- Actual phones must pass [tracking acceptance](pose-quality.md). Automation is not hardware acceptance.

## Principles

- Test externally meaningful behavior and stable contracts, not incidental implementation structure.
- Put each scenario at the lowest level that proves it reliably.
- Keep tests deterministic, isolated, order-independent, and parallel-safe.
- A defect fix requires a regression test that fails for the defect and passes for the fix.
- Hard cutovers remove tests of obsolete behavior. Do not retain compatibility assertions.
- A passing test suite is necessary but does not replace design, security, accessibility, or data review.

## Test levels

| Level | Purpose | Use when |
| --- | --- | --- |
| Unit | Prove domain rules and boundary transformations quickly | Logic can run without real I/O |
| Component | Prove one component through its public interface | Several units collaborate behind a stable boundary |
| Integration | Prove adapters against real protocol or infrastructure behavior | Serialization, persistence, framework wiring, or vendor contracts matter |
| Contract | Prove producer/consumer agreement | Independently changing processes or generated schemas communicate |
| End-to-end | Prove a small set of critical user journeys | The full deployed or production-like system must collaborate |
| Static checks | Catch formatting, type, lint, dependency, and security defects | The chosen stack supports the relevant analyzer |

Do not reproduce every scenario at every level. Keep end-to-end coverage narrow and high-value; push edge cases into faster tests.

## Scenario requirements

For each changed behavior, consider and cover where meaningful:

- the primary success case;
- input boundaries, empty values, size limits, and invalid forms;
- authorization and trust-boundary failures;
- dependency failure, timeout, cancellation, and retry behavior;
- concurrency, idempotency, ordering, and transaction behavior;
- serialization and persistence round trips;
- user-visible loading, empty, error, and recovery states;
- accessibility via semantic queries and keyboard interaction;
- explicit rejection of an obsolete contract after a hard cutover.

## Test data and environment

- Build the smallest fixture that communicates intent; use builders or factories only after repetition justifies them.
- Never use production secrets or unredacted personal data.
- Control time, randomness, locale, network, and process environment explicitly.
- Prefer real lightweight dependencies or faithful local substitutes at integration boundaries; mock only owned seams and observable failure modes.
- Clean up resources even after test failure, and make parallel execution collision-safe.
- Keep golden files and snapshots small, reviewed, deterministic, and focused on meaningful output.

## Required quality gates

The selected stack must eventually provide one canonical command for each applicable gate:

1. Formatting verification.
2. Linting with no unexplained warnings.
3. Static/type analysis with no blanket suppression.
4. Unit and component tests.
5. Integration tests against production-equivalent contracts.
6. A narrow end-to-end smoke suite for critical journeys.
7. Production build/package validation.
8. Dependency, vulnerability, secret, and generated-artifact checks appropriate to the stack.

CI must use the same commands as local development. Required gates must fail closed; do not configure broad `allow_failure` behavior.

## Coverage policy

No repository-wide line percentage is used. Risk-bearing contracts require direct behavioral tests: landscape entry/teardown, packet validation, renderer geometry, production asset paths, worker initialization, and first-packet inference are covered in the first slice. Reconsider a numeric threshold only when measured coverage identifies a concrete blind spot; do not optimize tests for a vanity percentage.

Coverage exclusions must be narrow, explained, and limited to code that cannot carry meaningful behavior, such as generated output.

## Flake and skip policy

Flaky tests are defects. Diagnose and repair or revert the introducing change; do not normalize retries as the solution. Focused-only markers, unchecked snapshot updates, skipped tests, and quarantines may not be merged as a way to obtain a green build. A temporary exception requires explicit ownership and a tracked removal condition.

## Reporting verification

At handoff, list the exact commands run and their outcomes. Separately list checks that were not run and why. Never say “all tests pass” when only a targeted subset ran or no test tooling exists.
