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

As last verified on **2026-08-14**, JojixPlay is a greenfield static web application with its first vertical slice and two television-local games implemented. The product is a phone-to-television body-control playground: pose estimation remains on the phone, public decentralized rendezvous establishes a direct WebRTC connection, and only validated pose landmarks reach the television. The phone accepts portrait or landscape capture, normalizes MediaPipe input and landmarks into one upright coordinate basis, and publishes an explicit frame layout and epoch. Phone and television present each detection as the one canonical faceless procedural body avatar; its private one-player display stabilization never changes control or game input. The television mirrors presentation horizontally, grants a temporary gesture-claimed control lease, exposes orientation-aware body-operated Main Menu/Games navigation, and hosts the ephemeral Draw and Bubbles games behind separate Canvas renderers. New sessions use one-player inference by default; acknowledged television-to-phone commands can select two-player inference or request an absolute camera layout without restarting the camera. Draw uses an immediate body-relative two-hand grip with wide release hysteresis and one main-hand Pencil/Eraser cursor. Bubbles uses both complete hands independently of the menu lease, exact timed rounds, and identity-independent screen-side scoring. Draw and one-player Bubbles accept either layout; two-player Bubbles requires landscape. The phone exposes bounded local pose and orientation diagnostics for real-device decisions. Complete real-device acceptance remains outstanding; publication state is tracked separately in project status.

The canonical product contracts are [Phone-to-television prototype](docs/product/skeleton-viewer.md), [Camera orientation and game layouts](docs/product/camera-orientation.md), [Procedural body avatar](docs/product/avatar-renderer.md), [Draw game](docs/product/draw-game.md), and [Bubbles game](docs/product/bubbles-game.md). The live implementation state is maintained in [Project status](docs/project/status.md), and exact tools and commands live in [Stack](docs/architecture/stack.md). Never infer capabilities beyond those sources.

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
| One-player pose stability and model measurement | `docs/engineering/pose-quality.md` |
| Camera coordinate basis, layout policy, and orientation transitions | `docs/product/camera-orientation.md` |
| Prioritized work not tracked elsewhere | `docs/project/backlog.md` |

If sources disagree, stop and reconcile them in the same change. Do not choose whichever instruction is most convenient.

## Stack policy

The selected client stack is TypeScript, Vite, Preact, MediaPipe Tasks Vision, Trystero, Canvas 2D, Node 24, and npm. GitHub Actions validates pull requests and deploys validated `main` artifacts to GitHub Pages. [ADR-0002](docs/decisions/0002-static-peer-to-peer-runtime.md), [ADR-0003](docs/decisions/0003-client-stack-and-renderer-boundary.md), [ADR-0006](docs/decisions/0006-session-player-limit-control.md), [ADR-0007](docs/decisions/0007-node-24-and-dependency-maintenance.md), [ADR-0008](docs/decisions/0008-above-head-coarse-hand-controls.md), [ADR-0009](docs/decisions/0009-camera-paced-inference.md), [ADR-0010](docs/decisions/0010-menu-and-draw-game.md), [ADR-0011](docs/decisions/0011-consumer-specific-pose-stability.md), [ADR-0012](docs/decisions/0012-two-hand-draw-grip.md), [ADR-0013](docs/decisions/0013-identity-independent-bubbles-game.md), [ADR-0014](docs/decisions/0014-procedural-body-avatar.md), and [ADR-0015](docs/decisions/0015-canonical-camera-orientation.md) govern these boundaries.

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
6. Long-lived secrets and personal data are never committed, logged, embedded in fixtures, or exposed in build artifacts. Each ephemeral 100-bit pairing key is shown only on its television session, travels through the QR fragment or direct user entry, is scrubbed from the URL after parsing, and otherwise remains in runtime memory.
7. Behavior changes include proportional automated tests; defect fixes include regression tests.
8. Builds and tests are deterministic, isolated from ambient machine state, and suitable for CI.
9. Operational failures are observable without leaking sensitive data.
10. Superseded code and documentation are deleted during the cutover.
11. `PosePacket` remains unsmoothed, unmirrored pose data in the phone's upright canonical camera coordinates. Phone-owned quarter-turn normalization occurs before the packet boundary; avatar drawing, television mirroring, Draw, Bubbles simulation/input, cursor projection, adaptive layout, and hit testing never mutate transport data or swap anatomical landmark indices.
12. Pose-array position is never a player identity. Only bounded television-local nearest-torso continuity may preserve a temporary control lease; it must not become a transmitted, persisted, or stable person identifier.
13. Every pairing session starts with a one-pose inference limit. A switch to one or two poses is an absolute, strictly validated TV-to-phone request; the TV changes its displayed mode only after the phone has reconfigured the existing landmarker and returned the matching acknowledgement.
14. Temporal processing never mutates `PosePacket` or creates one universal smoothed pose. Continuous drawing, two-hand grip classification, Bubbles point/swept collision, button controls, and presentation own explicitly separate derived signals with measured latency contracts; local diagnostics remain bounded aggregates and never log, persist, or transmit coordinates.
15. Main Menu and Games targets form one frozen above-head row in portrait and one frozen compact left column in landscape. Draw and Bubbles Ready/Finished always use the compact left column. Every target remains inside the projected canonical frame; hit testing and rendering share the same rectangles, and Bubbles Starting/Playing exposes no action targets.
16. Wrist landmarks own control claim and release. The selected wrist/pinky/index/thumb centroid exclusively owns cursor projection and dwell; an incomplete hand hides the pointer, and every new lease must observe that pointer clear of all targets before body activation arms.
17. Phone inference follows eligible camera callbacks up to the requested 30 FPS camera ceiling with exactly one estimate in flight. There is no independent lower sampling timer, queued frame, parallel landmarker, or stale-work fallback.
18. Main Menu, Games, Draw, and each actionable Bubbles phase replace the complete typed action set atomically. A transition retains the short-lived controller lease when possible but clears target hover/dwell/latching and requires neutral re-arming; the deleted Circles action and effect must not return. Active Bubbles rounds suspend rather than merely hide body-control activation.
19. Draw paths remain ephemeral television-local normalized canonical-camera coordinates. Mirroring is presentation-only; only the leased pose's selected complete coarse hand supplies Pencil or Eraser points. A fresh `≤ 0.75 × shoulder span` two-hand grip engages immediately, remains active through the hysteresis band, and releases at `≥ 1.25 × shoulder span`; stale input, controller/view loss, or camera-basis changes cancel it. Supporting-hand loss alone neither releases the grip nor breaks the main-hand path; main-hand loss, bounds, toolbar entry, and implausible jumps break paths without adding bridge segments.
20. Bubbles state is ephemeral and television-local. Its player count is captured from the acknowledged mode on game entry; one-player pops use the sole right score slot, while two-player pops belong only to mirrored left/right screen slots selected from current torso position. Pose-array order, the menu lease, and any stable or transmitted identity must never own a Bubbles score.
21. Bubbles uses exact monotonic three-second/60-second deadlines, both complete coarse hands, current-point plus bounded fresh swept collision, and radius-aware clamp-and-reflect inside the projected camera arena. A bubble scores at most once; ordinary pose loss never pauses the clock, while an active-game camera-layout mismatch freezes the complete game clock and simulation. Non-increasing, stale, missing, out-of-frame, camera-basis-changed, or implausibly long hand motion cannot create a bridge collision.
22. The procedural Canvas body avatar is the only live pose renderer. Each canvas owns an isolated presentation session: one-pose copies may use the bounded adaptive landmark, segment-length, and depth-order stabilization in [Avatar renderer](docs/product/avatar-renderer.md), while zero- and multi-pose frames reset that history and multi-pose rendering uses current-packet geometry only. No avatar value may feed controls, Draw, Bubbles, transport, or a stable identity; no stick-skeleton fallback exists.
23. `PosePacket.frame` is exactly `{ width, height, layout, epoch }`. Dimensions must agree with `portrait` or `landscape`; `epoch` changes on every committed camera-basis change. Every temporal consumer resets on an epoch change. The phone alone owns source rotation, passes the matching quarter-turn to MediaPipe, transforms its unrotated output coordinates once, and exposes source metadata only through bounded local diagnostics.
24. Main Menu, Games, Draw, and one-player Bubbles support portrait and landscape; two-player Bubbles requires landscape. A game captures its entering layout. Incompatible entry uses one strict acknowledged TV-to-phone absolute layout request, while an active mismatch withholds pose input and requests return to the captured layout. Draw retains art but cancels grip/path; Bubbles freezes and later resumes its complete timed state. No aspect-ratio proxy, hot game reflow, screen-lock dependency, or orientation fallback exists.

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
