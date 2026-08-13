# Agent operating guide

This file applies to the entire repository. It is the first operational source of truth for human and automated contributors.

## Non-negotiable project posture

> **GREENFIELD PROJECT — HARD CUTOVERS ONLY. BACKWARDS COMPATIBILITY IS TOTALLY FORBIDDEN UNLESS THE USER EXPLICITLY REQUESTS IT. THIS IS NON-NEGOTIABLE.**

This project is in early development. There are no supported historical contracts unless a current requirement explicitly creates one.

- Backwards compatibility is **totally forbidden unless the user explicitly requests it for the current task**. Do not preserve old APIs, schemas, configuration keys, file layouts, behavior, or internal abstractions “just in case.”
- A replacement must be a hard cutover: update every in-repository caller, test, fixture, and document, then delete the superseded path in the same change.
- Do not add compatibility shims, legacy adapters, deprecated aliases, fallback branches, dual reads, dual writes, version sniffing, shadow implementations, or migration-only runtime paths unless the user explicitly requires compatibility for the task at hand.
- Do not keep commented-out code, dead code, obsolete tests, unused exports, abandoned files, or TODOs that merely postpone deletion. Version control is the archive.
- Do not silently tolerate invalid or obsolete input. Validate at boundaries and fail clearly.
- “Safer” and “more flexible” are not valid reasons to retain a legacy path. Any compatibility exception requires explicit user authorization and a recorded decision that defines its exact scope and removal condition.

These rules are architectural constraints, not preferences. See [ADR-0001](docs/decisions/0001-greenfield-hard-cutover.md).

## Repository reality

As last verified on **2026-08-13**, JojixPlay is a greenfield static web application with its first vertical slice deployed to GitHub Pages. The product is a phone-to-television skeleton viewer: pose estimation remains on the phone, public decentralized rendezvous establishes a direct WebRTC connection, and only validated pose landmarks reach the television. Complete real-device acceptance remains outstanding.

The canonical product contract is [Skeleton-viewer prototype](docs/product/skeleton-viewer.md). The live implementation state is maintained in [Project status](docs/project/status.md), and exact tools and commands live in [Stack](docs/architecture/stack.md). Never infer capabilities beyond those sources.

## Required reading order

Before changing the repository, read only the material relevant to the task, starting with:

1. [Project status](docs/project/status.md) — current capabilities, blockers, and next decisions.
2. [Stack](docs/architecture/stack.md) — selected tools and canonical commands.
3. [Architecture overview](docs/architecture/overview.md) — boundaries and system shape.
4. [Engineering standards](docs/engineering/standards.md) — implementation expectations.
5. [Testing strategy](docs/engineering/testing.md) — required validation.
6. [Decision records](docs/decisions/README.md) — durable architectural constraints.

Use the [documentation index](docs/README.md) to find all other material.

## Source-of-truth map

| Concern | Canonical source |
| --- | --- |
| Agent rules and repository-wide invariants | `AGENTS.md` |
| Current state, risks, and immediate next work | `docs/project/status.md` |
| Language, framework, toolchain, versions, commands | `docs/architecture/stack.md` |
| Components, boundaries, data flow, deployment shape | `docs/architecture/overview.md` |
| Durable architectural decisions | `docs/decisions/` |
| Code quality and design rules | `docs/engineering/standards.md` |
| Test levels and quality gates | `docs/engineering/testing.md` |
| Contribution workflow and completion checklist | `docs/engineering/workflow.md` |
| Prioritized work not tracked elsewhere | `docs/project/backlog.md` |

If sources disagree, stop and reconcile them in the same change. Do not choose whichever instruction is most convenient.

## Stack policy

The selected client stack is TypeScript, Vite, Preact, MediaPipe Tasks Vision, Trystero, Canvas 2D, and npm. GitHub Actions validates and deploys the static artifact to GitHub Pages. [ADR-0002](docs/decisions/0002-static-peer-to-peer-runtime.md) and [ADR-0003](docs/decisions/0003-client-stack-and-renderer-boundary.md) govern these boundaries.

- Use only the versions and canonical commands in `docs/architecture/stack.md` and the committed lockfile.
- Prefer current, supported stable releases and one canonical tool per concern.
- Do not introduce an application backend, persistence, TURN, alternate signaling path, or game engine without an accepted replacement decision.
- Avoid dependencies when a small, well-tested platform solution is clearer; otherwise prefer mature, maintained, narrowly scoped dependencies.

## Engineering invariants

Every implementation must preserve these invariants:

1. There is exactly one canonical implementation of each capability.
2. Invalid state is rejected at the earliest owned boundary with an actionable error.
3. Domain behavior is separated from transport, persistence, UI, and vendor details once those layers exist.
4. Dependencies point toward stable domain concepts; external systems are accessed through explicit boundaries.
5. Configuration is explicit, validated at startup, and free of hidden environment-dependent defaults.
6. Long-lived secrets and personal data are never committed, logged, embedded in fixtures, or exposed in build artifacts. Ephemeral pairing credentials travel only through the intended QR fragment, are scrubbed after parsing, and otherwise remain in runtime memory.
7. Behavior changes include proportional automated tests; defect fixes include regression tests.
8. Builds and tests are deterministic, isolated from ambient machine state, and suitable for CI.
9. Operational failures are observable without leaking sensitive data.
10. Superseded code and documentation are deleted during the cutover.

If the chosen architecture legitimately changes an invariant, update this file and create or amend an ADR before relying on the new rule.

## Implementation practices

- Understand the affected path before editing it. Search for all callers, tests, fixtures, configuration, generated artifacts, and documentation.
- Prefer the smallest coherent design that fully satisfies the requirement. Do not add speculative layers, generic frameworks, or unused extension points.
- Use precise names, explicit contracts, narrow interfaces, and strong static types where the chosen stack supports them.
- Keep modules focused and dependencies visible. Avoid global mutable state and action-at-a-distance behavior.
- Validate untrusted input at system boundaries. Keep internal code operating on validated, meaningful types.
- Handle errors deliberately. Never swallow failures or convert them to misleading success values.
- Make security, accessibility, performance, and observability part of the design rather than deferred cleanup.
- Use automated formatters, linters, type checkers, security checks, and dependency checks selected for the stack. Do not blanket-disable them.
- Comments explain intent, constraints, and non-obvious tradeoffs. They do not narrate obvious syntax or preserve deleted code.
- A TODO must identify a concrete unresolved action and, once issue tracking exists, link to an owner or issue. Delete stale TODOs.

## Testing and verification

Canonical quality commands are defined in [Stack](docs/architecture/stack.md). Do not invent alternate commands or claim checks that were not run.

For each change:

- Add or update tests at the lowest useful level.
- Cover the success path, meaningful boundary cases, and expected failure behavior.
- Add a regression test before or with every defect fix.
- Run all affected quality gates, then the full canonical suite when practical.
- Report exactly what was run and any checks that could not be run.
- Do not commit skipped, focused-only, quarantined, or flaky tests as a way to obtain a green build.

Detailed expectations are in [Testing strategy](docs/engineering/testing.md).

## Documentation policy

Documentation is part of the implementation, not follow-up work.

- Update the canonical document in the same change that alters a command, contract, boundary, decision, invariant, or project status.
- Keep one canonical home for each fact and link to it elsewhere; do not duplicate evolving details.
- Use repository-relative links, stable headings, ISO 8601 dates, and explicit status words such as `Active`, `Draft`, `Unknown`, `Superseded`, or `Resolved`.
- Describe current truth. Put durable rationale in an ADR and history in version control or the milestone log; do not turn reference docs into chronological diaries.
- Never document planned behavior as implemented behavior.
- Delete stale instructions and links during hard cutovers.

See the [documentation index](docs/README.md) for organization and maintenance rules.

## Change workflow

1. Read the relevant source-of-truth documents and inspect the current implementation.
2. State or resolve unknown requirements that would materially change the design.
3. Record consequential, durable decisions in `docs/decisions/`.
4. Implement one complete canonical path; perform the hard cutover and delete the displaced path.
5. Add tests and run the documented quality gates.
6. Update documentation, status, and backlog entries affected by the work.
7. Review the diff for secrets, dead code, accidental compatibility behavior, stale references, and unrelated edits.

The complete checklist is in [Engineering workflow](docs/engineering/workflow.md).

## Definition of done

A change is complete only when:

- the requested behavior works through the canonical path;
- obsolete paths and artifacts are gone;
- relevant tests exist and documented checks pass;
- error, security, data, accessibility, and operational implications were considered;
- affected documentation reflects current truth;
- no unexplained TODO, compatibility layer, warning suppression, or commented-out code remains; and
- the handoff states what changed, what was verified, and any genuine remaining risk.
