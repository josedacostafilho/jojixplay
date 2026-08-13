---
status: Active
last_verified: 2026-08-13
scope: Change lifecycle, review, and completion workflow
---

# Engineering workflow

## Before implementation

1. Read [`../../AGENTS.md`](../../AGENTS.md), [Project status](../project/status.md), and the task-relevant canonical docs.
2. Inspect the repository and search for all affected callers, contracts, tests, fixtures, configuration, generated files, and docs.
3. Separate confirmed requirements from assumptions. Resolve unknowns that would materially change behavior, data, security, or architecture.
4. Define acceptance criteria and the smallest end-to-end change that satisfies them.
5. Create an ADR before implementing a consequential or difficult-to-reverse decision.
6. Preserve unrelated user work and keep the change scoped.

## During implementation

- Build one canonical path and keep intermediate states short-lived.
- For a replacement, update all owned consumers and remove the displaced path in the same change.
- Add tests alongside behavior and run fast, targeted checks frequently.
- Keep errors explicit, data validated, secrets out of output, and dependencies narrowly justified.
- Update canonical documentation when a fact changes; do not defer it to an unspecified follow-up.
- Remove exploratory scaffolding, debug output, unused dependencies, temporary flags, and commented code before review.

## Hard-cutover checklist

For any rename or replacement, search for and remove:

- old symbols, exports, endpoints, routes, fields, and configuration keys;
- old schema versions, tolerant parsers, aliases, adapters, and fallback branches;
- old fixtures, snapshots, factories, mocks, generated clients, and test descriptions;
- old scripts, environment examples, deployment settings, and dependencies;
- old documentation, examples, comments, and links;
- stale persisted data, using one bounded transformation only when real owned data requires it.

Do not call a cutover complete while both forms remain reachable.

## Verification sequence

Once the stack defines commands, run:

1. Targeted tests for rapid feedback.
2. Formatter and formatting verification.
3. Linter and static/type analysis.
4. Full unit/component test suite.
5. Applicable integration and end-to-end suites.
6. Production build/package validation.
7. Applicable security, dependency, secret, migration, and generated-file checks.

Inspect the final diff even when automation passes. Look for accidental files, unrelated formatting, secret material, stale references, broad suppressions, and unintended compatibility behavior.

## Documentation closeout

- Update `last_verified` only on documents actually checked against the changed implementation.
- Update [Stack](../architecture/stack.md) when a tool, version, or command changes.
- Update [Architecture overview](../architecture/overview.md) when a component, boundary, data flow, or deployment shape changes.
- Update [Project status](../project/status.md) when current capability or risk changes.
- Remove completed backlog entries; add a [milestone](../project/milestones.md) only for a durable project-level event.
- Add or supersede an ADR when the rationale for a durable choice changes.

## Handoff format

A useful handoff is factual and compact:

- **Outcome:** what behavior or project truth now exists.
- **Key changes:** the important files, boundaries, or contracts affected.
- **Verification:** exact commands run and outcomes.
- **Remaining risk:** only genuine known limitations or unrun checks.

Do not label routine future ideas as required next steps, and do not claim completion if obsolete paths or required validation remain.

## Review checklist

- [ ] Acceptance criteria are satisfied through the canonical path.
- [ ] No backwards-compatibility mechanism was added without explicit authorization.
- [ ] Superseded code, tests, configuration, dependencies, and docs are deleted.
- [ ] Boundary validation, error behavior, security, privacy, accessibility, and operational impact were reviewed where applicable.
- [ ] Tests cover changed behavior and regression risk.
- [ ] Canonical quality gates pass, or unrun checks are explicitly reported.
- [ ] Documentation describes current truth and contains no broken references.
- [ ] No secrets, debug output, dead code, unexplained TODOs, or blanket suppressions remain.
