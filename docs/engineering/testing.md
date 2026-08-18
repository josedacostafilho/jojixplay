---
status: Active
last_verified: 2026-08-18
scope: Automated test strategy and release quality gates
---

# Testing strategy

## Current state

Vitest, Testing Library, Playwright, Biome, TypeScript, production building, and dependency auditing are the selected quality gates for the first slice. Exact commands live in [Stack](../architecture/stack.md).

## Prototype-specific coverage

- Unit tests prove strict application-mode routing and obsolete `role` rejection, mode-specific capability baselines including rendering-host-only Web Audio, pairing-key entropy and normalization, strict fragment parsing, stable domain-separated credential derivation, strict canonical camera frames/epochs, screen-orientation parsing, every quarter-turn transform, camera/game layout policies, pose-packet and player-limit validation, sequence rejection, opposite-role peer authentication, obsolete-protocol rejection, player-limit/layout request matching and authorization, MediaPipe rotation/output mapping, tracking reset, in-place player reconfiguration, the shared paired/local camera lifecycle, apply-before-display local reconfiguration, stable camera-basis transitions, transient-invalid-orientation handling, camera-paced single-flight inference, bounded local pose/orientation diagnostics, malformed-packet termination, extra-peer isolation, mirrored aspect-ratio mapping, latest-only send coalescing, controller-claim timing, multiperson contention, epoch resets, overhead-row and compact left-column layouts, control suspension, both-hand projection plus shoulder span, neutral arming, action-specific button dwell, immediate body-relative Draw grip thresholds, release hysteresis, orientation suspension, main-hand Pencil/Eraser ownership, responsive path smoothing and path breaks, normalized mark retention, color/clear behavior, every lease-release path, Bubbles readiness and exact deadlines, full-state pause/resume, normalized radius-safe drift/reflection, pop/respawn lifecycle, current and swept hand collision boundaries, camera-basis history resets, side-slot attribution, results/restart, Racing torso-lean mirroring and aspect correction, hand-independent readiness, temporary side leases, pose-array reorder/dropout/epoch behavior, pause latching, fresh torso calibration, symmetric dead-zone/full-scale analog mapping, response filtering, dropout centering, fixed-step cadence equivalence, automatic throttle, off-road drag, pause/recenter freezes, one-/two-player finish results, dense deterministic track construction and full-speed feasibility, full/half-viewport pseudo-3D road geometry, explicit near-road bottom coverage, approach/side-by-side/overtake/curve opponent projection, audio graph ownership, bounded Draw/Racing voices, mute, visibility suspend/resume, audio startup failure cleanup, pose adaptation, procedural rendering, immutable avatar display copies, adaptive one-pose smoothing, bounded segment stabilization, depth hysteresis, history-free multi-pose presentation, torso/partial-landmark failure behavior, procedural body primitives, palette selection, mirroring, and appearance profiles.
- Component tests prove three-mode selection, strict invalid-link recovery, blocking phone-link errors, unsupported-device behavior, trusted TV/local audio startup and partial-failure cleanup, no-preview hidden capture, direct packet/freshness flow, local request pending/cleanup behavior, optional immersive ownership, the collapsed privacy-explicit paired-phone diagnostics surface, portrait headroom and arming guidance, landscape menu columns, semantic Main Menu/Settings/Games/Draw/Bubbles/Racing navigation, Sound/Background settings, apply-before-display dynamic player labels, pending-action suspension, camera-layout gates, active-game layout locking, failure announcements, white projected Draw bounds, one selected Draw cursor, Draw contact/tool cues, the compact vertical toolbar, retained in-session Draw state, projected Bubbles bounds, one-/two-player HUD placement, exact countdown/timer/sound transitions, active-round control suspension, finished actions, Racing lazy-runtime readiness/failure, one-player torso calibration/drive/pause/finish/audio flow, active-control suppression, two-player landscape gating, avatar omission, result actions, runtime/audio teardown, event-driven avatar canvas rendering, menu/Draw/Bubbles/paired-phone avatar appearances, and accessible game actions.
- End-to-end smoke tests prove the static three-mode journey, trusted TV-mode/audio/fullscreen attempt, television QR/manual-key surface, paired-phone manual entry, production asset loading, fake camera acquisition after user activation, real MediaPipe worker/model initialization in paired and local modes, completion of each first canonical inference packet, visible active layout, local hidden capture/no preview, successful local operation with WebSocket and WebRTC APIs absent, local stop resource release, high game-message/lower-action stacking, and production-path loading of the lazy forced-Canvas Racing runtime with non-sky pixels at a formerly uncovered near-road boundary.
- Browser automation must not depend on public Nostr relay availability. Direct peer discovery is verified separately on real devices.
- The phone camera/inference path uses Chromium fake-media support where deterministic; it does not claim pose-quality or device-performance coverage.
- Manual acceptance on a real phone and television is required before the hardware-dependent milestone is complete. It must cover paired portrait/both-landscape behavior, preview alignment, horizontal mirroring, layout requests, active-game pause/resume, audio activation/mix/background recovery, Racing startup and sustained one-/two-player Canvas/audio cadence, torso-lean dead-zone/intermediate/full-scale comfort and latency, opponent visibility, tracking-loss feedback, and split-screen readability. It must separately cover local no-preview framing, direct commands, optional fullscreen/wake behavior, combined inference/render/audio cadence, thermals, cleanup, and external-mirroring latency/quality; automation cannot prove device camera metadata, body-control ergonomics, target-display performance, speaker behavior, or OS mirroring behavior.

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

No repository-wide line percentage is used. Risk-bearing contracts require direct behavioral tests: pairing fragments, packet validation and ordering, peer role authentication, renderer geometry, backpressure, routing errors, production asset paths, worker initialization, and first-packet inference are covered in the first slice. Reconsider a numeric threshold only when measured coverage identifies a concrete blind spot; do not optimize tests for a vanity percentage.

Coverage exclusions must be narrow, explained, and limited to code that cannot carry meaningful behavior, such as generated output.

## Flake and skip policy

Flaky tests are defects. Diagnose and repair or revert the introducing change; do not normalize retries as the solution. Focused-only markers, unchecked snapshot updates, skipped tests, and quarantines may not be merged as a way to obtain a green build. A temporary exception requires explicit ownership and a tracked removal condition.

## Reporting verification

At handoff, list the exact commands run and their outcomes. Separately list checks that were not run and why. Never say “all tests pass” when only a targeted subset ran or no test tooling exists.
