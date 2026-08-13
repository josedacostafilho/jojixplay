---
status: Active
last_verified: 2026-08-13
scope: Greenfield development and compatibility policy
---

# ADR-0001: Greenfield development with mandatory hard cutovers

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** None
- **Superseded by:** None

## Context

The project is under early greenfield development. Preserving superseded contracts at this stage would create multiple paths, weaken design freedom, hide invalid usage, enlarge the test surface, and turn temporary implementation details into accidental long-term obligations.

The project owner explicitly requires the hardest feasible cutover approach and forbids backwards compatibility unless it is explicitly requested for a specific task. Clean current design takes priority over preservation of historical behavior.

## Decision

All replacements are hard cutovers.

When a contract, schema, API, configuration key, file layout, dependency, tool, or implementation changes, the same change must:

1. Introduce the new canonical form.
2. Update every owned caller, consumer, test, fixture, script, and document.
3. Convert owned data directly when conversion is actually required.
4. Delete the superseded form and all support code for it.
5. Reject obsolete input clearly rather than silently accepting or translating it.

The following are forbidden by default:

- backwards-compatible aliases or overloads;
- deprecated endpoints, fields, exports, flags, or configuration keys;
- adapters or wrappers whose only purpose is to preserve an old internal contract;
- fallback parsing, version detection, or “try old then new” behavior;
- dual reads, dual writes, shadow traffic, and parallel implementations;
- dormant feature flags that retain the previous implementation;
- commented-out code, dead branches, obsolete fixtures, and renamed “legacy” files;
- broad exception handling that masks obsolete behavior;
- speculative migration hooks for users or data that do not exist.

A normal release rollback may redeploy a previously known-good artifact. That operational capability does not justify compatibility code inside the current artifact.

## Exception rule

Compatibility may exist only when the user explicitly asks for it in the current scope. An exception must be documented before or with implementation and must identify:

- the exact external consumer or data that cannot move atomically;
- the narrow compatibility surface;
- why a hard cutover is impossible for that consumer;
- an owner, measurable removal condition, and deletion plan; and
- tests proving both containment and eventual cutover behavior.

Convenience, fear of unknown callers, generic industry custom, or speculative future use do not qualify. Internal repository callers are always migrated atomically.

## Consequences

### Benefits

- The design can improve without carrying accidental historical constraints.
- Each capability has one understandable implementation and one test path.
- Invalid usage fails visibly instead of surviving behind fallbacks.
- Maintenance, security review, and agent reasoning operate on a smaller state space.

### Costs and risks

- A cutover may require a larger coordinated change.
- Call-site discovery, data ownership, and validation must be thorough.
- Any genuine external consumer must be identified before changing its contract.
- Rollback planning must operate at the release or data-backup level rather than through permanent compatibility code.

These costs are accepted.

## Alternatives considered

### Deprecation windows

Rejected. They deliberately maintain two contracts and are not justified in a greenfield project without external compatibility obligations.

### Compatibility adapters and tolerant readers

Rejected. They hide stale usage, expand the state space, and tend to outlive their stated purpose.

### Case-by-case developer discretion

Rejected. It makes the codebase posture inconsistent and permits speculative legacy behavior. Only explicit user authorization can create an exception.

## Verification

Review each replacement by searching for old names, contracts, configuration, schemas, fixtures, comments, and documentation. The full test suite must exercise only the canonical form and must include rejection tests when obsolete external input could otherwise be accepted.

