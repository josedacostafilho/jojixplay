---
status: Active
last_verified: 2026-09-24
scope: Automated test strategy and release quality gates
---

# Testing strategy

## Current state

Vitest, Testing Library, Playwright, Biome, TypeScript, production building, and dependency auditing are the selected quality gates for the first slice. Exact commands live in [Stack](../architecture/stack.md).

## Phone-specific coverage

- Unit tests cover landscape frame validation, source quarter-turn normalization and stable epochs, camera-paced single-flight inference, player reconfiguration, pose consumers, game rules, deterministic rendering, and audio ownership.
- Component tests cover portrait entry gating and teardown, rejection of obsolete links, direct packet freshness, apply-before-display player selection, trusted camera/audio startup and failure cleanup, hidden capture, left-column controls, all game navigation, and optional immersive resource ownership including late lock completion.
- Production Chromium tests cover rotate-to-enter, real camera/MediaPipe startup without peer APIs, hidden capture, stop cleanup, action/message stacking, and lazy forced-Canvas Racing rendering.
- Real-phone acceptance must cover both landscape directions, lock support/rejection, portrait teardown, camera normalization, full-body framing, controls, sound, thermals, sustained one-/two-player performance, and external screen-mirroring latency. Automation does not establish hardware acceptance.

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

No repository-wide line percentage is used. Risk-bearing contracts require direct behavioral tests: landscape entry/teardown, packet validation, renderer geometry, invalid-link recovery, production asset paths, worker initialization, and first-packet inference are covered in the first slice. Reconsider a numeric threshold only when measured coverage identifies a concrete blind spot; do not optimize tests for a vanity percentage.

Coverage exclusions must be narrow, explained, and limited to code that cannot carry meaningful behavior, such as generated output.

## Flake and skip policy

Flaky tests are defects. Diagnose and repair or revert the introducing change; do not normalize retries as the solution. Focused-only markers, unchecked snapshot updates, skipped tests, and quarantines may not be merged as a way to obtain a green build. A temporary exception requires explicit ownership and a tracked removal condition.

## Reporting verification

At handoff, list the exact commands run and their outcomes. Separately list checks that were not run and why. Never say “all tests pass” when only a targeted subset ran or no test tooling exists.
