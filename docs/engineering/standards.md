---
status: Active
last_verified: 2026-08-13
scope: Design, implementation, security, and maintainability expectations
---

# Engineering standards

## Baseline

The project is greenfield. Optimize for a clear current design, not historical behavior. Backwards compatibility, fallback implementations, and retained legacy code are forbidden unless explicitly required by the user for the current task. Apply [ADR-0001](../decisions/0001-greenfield-hard-cutover.md) without exception-by-convenience.

## TypeScript and browser rules

- Keep TypeScript strict, including unchecked-index and exact-optional-property checks. Do not use `any`, non-null assertions, or blanket suppressions to bypass a boundary.
- Parse external values from `unknown` and return validated domain types. Network messages, URL fragments, worker messages, and browser capability state are trust boundaries.
- Use Preact for UI state and lifecycle. Direct canvas drawing and video-frame scheduling must not run through component rerenders.
- A worker owns MediaPipe. Television and shared rendering modules must not import the inference dependency.
- Acquire camera access only after user activation, request no audio, and stop every owned media track during cleanup.
- Use Web Crypto for session randomness. Never expose credentials through logs, query parameters, analytics, or error messages.
- Prefer browser capability checks with explicit unsupported states over polyfills, browser sniffing, or alternate implementations.
- Keep public-relay and peer failures terminal and actionable; do not silently switch transports.

## Design

- Start from an observable requirement and implement the smallest complete solution.
- Keep one authoritative representation and one canonical execution path.
- Prefer explicit data flow and dependency injection at real boundaries over hidden global state.
- Separate pure domain decisions from I/O so important behavior is inexpensive to test.
- Introduce an abstraction only when it isolates a real boundary or has a demonstrated second use. Do not create interfaces solely to mirror every class or function.
- Make ownership, lifecycle, mutation, transaction scope, retry behavior, and concurrency assumptions explicit.
- Prefer composition and small cohesive modules over deep inheritance or multipurpose utility collections.
- Delete replaced code. Never rename it to `old`, `legacy`, `v1`, `backup`, or leave it commented out.

## Contracts and data

- Use explicit schemas or strong types at process and trust boundaries when supported by the stack.
- Validate syntax, semantics, size, and authorization before data enters domain logic.
- Reject unknown or obsolete fields when silently accepting them would hide a broken caller.
- Define nullability and optionality deliberately; do not use missing values as undocumented control flow.
- Keep one canonical serialization format and one source of truth for generated schemas or clients.
- Treat schema changes as hard cutovers. If real persisted data exists, use a bounded, verified transformation—not permanent dual-format runtime behavior.
- Make destructive data operations explicit, reviewed, backed up when appropriate, and testable.

## Errors and resilience

- Fail fast for invalid configuration and programmer errors.
- Return actionable errors at boundaries while keeping internal and sensitive details out of user-facing output.
- Catch only errors that can be handled meaningfully; otherwise propagate them with context.
- Set explicit timeouts on remote operations. Add retries only for demonstrated transient failures, with bounded backoff and idempotency.
- Never convert an exception to an empty result, default object, or success response merely to keep execution moving.
- Define partial-failure and cancellation behavior for multi-step or concurrent work.

## Security and privacy

- Apply least privilege to credentials, permissions, network access, and data queries.
- Keep secrets outside source control and provide redacted example configuration.
- Use maintained platform or library primitives for cryptography, authentication, authorization, and input parsing.
- Use safe parameterization and context-appropriate encoding; never construct executable queries or markup from untrusted strings.
- Avoid collecting or logging data that is not needed. Define retention and deletion before persisting sensitive data.
- Review dependencies and generated artifacts for supply-chain and secret-exposure risks.
- Enforce authorization at the authoritative runtime boundary, never through hidden UI state alone. In this serverless prototype, possession of the ephemeral 100-bit pairing key-derived secret plus the opposite-role peer handshake is the authorization boundary.

## Dependencies and generated code

- Each dependency must solve a current requirement and have an acceptable maintenance and security posture.
- Pin dependencies through the ecosystem’s canonical lock mechanism and update them intentionally.
- Use a single supported version; do not retain parallel major versions to ease an internal transition.
- Generated files must identify their source and generation command. Never hand-edit generated output.
- Commit generated output only when consumers or deployment require it, and verify regeneration is deterministic.
- Remove dependencies, scripts, and configuration as soon as their final consumer is deleted.

## User-facing quality

When a user interface exists:

- Use semantic structure, keyboard operation, visible focus, accessible names, sufficient contrast, and reduced-motion support as baseline requirements.
- Design explicit loading, empty, error, offline, and success states.
- Avoid layout shifts and prevent duplicate or ambiguous actions.
- Define measurable performance budgets using real user flows.
- Keep messages specific and recovery-oriented; never expose stack traces or secrets.

## Observability

When executable services exist:

- Use structured events with stable names and correlation identifiers.
- Distinguish operational signals from audit events and product analytics.
- Emit enough context to diagnose failure without logging secrets or unnecessary personal data.
- Define health, readiness, latency, error, and saturation signals appropriate to the component.
- Do not leave debug printing or high-cardinality instrumentation in production paths.

## Code review rejection criteria

A change is not acceptable if it contains speculative compatibility behavior, duplicate implementations, dead or commented-out code, unowned TODOs, swallowed errors, hidden defaults, unvalidated boundary input, real secrets, flaky/skipped tests, unexplained warning suppression, or documentation that describes a future state as present reality.
