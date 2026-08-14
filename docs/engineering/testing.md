---
status: Active
last_verified: 2026-08-14
scope: Automated test strategy and release quality gates
---

# Testing strategy

## Current state

Vitest, Testing Library, Playwright, Biome, TypeScript, production building, and dependency auditing are the selected quality gates for the first slice. Exact commands live in [Stack](../architecture/stack.md).

## Prototype-specific coverage

- Unit tests prove pairing-key entropy and normalization, strict fragment parsing, stable domain-separated credential derivation, pose-packet and player-limit validation, sequence rejection, opposite-role peer authentication, obsolete-protocol rejection, request/ack matching, request authorization, in-place worker reconfiguration, camera-paced single-flight inference, bounded local pose diagnostics, malformed-packet termination, extra-peer isolation, mirrored aspect-ratio mapping, latest-only send coalescing, controller-claim timing, multiperson contention, variable above-head layouts, both-hand projection/dropout, neutral arming, action-specific dwell, Draw tool engagement/lifting, outlier-tolerant capture-time stationarity, responsive path smoothing and path breaks, normalized mark retention, color/clear behavior, and every lease-release path.
- Component tests prove role selection, blocking phone-link errors, unsupported-device behavior, the collapsed privacy-explicit pose-diagnostics surface, explicit headroom and arming guidance, semantic Main Menu/Games/Draw navigation, acknowledged dynamic player labels, pending-action suspension, failure announcements, the background effect, white projected Draw bounds, retained in-session Draw state, reduced-opacity skeleton presentation, and accessible game actions.
- End-to-end smoke tests prove the static role-selection journey, trusted TV-mode/fullscreen attempt, television QR/manual-key surface, phone manual entry, production asset loading, fake camera acquisition after user activation, real MediaPipe worker/model initialization, and completion of the first inference packet.
- Browser automation must not depend on public Nostr relay availability. Direct peer discovery is verified separately on real devices.
- The phone camera/inference path uses Chromium fake-media support where deterministic; it does not claim pose-quality or device-performance coverage.
- Manual acceptance on a real phone and television is required before the hardware-dependent milestone is complete.

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
