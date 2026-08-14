---
status: Active
last_verified: 2026-08-14
scope: Documentation system and navigation
---

# Documentation index

This directory is the durable knowledge base for the project. It is organized for fast retrieval by both people and LLM agents: current facts have one canonical home, uncertainty is explicit, and durable decisions are separated from changing operational state.

Repository-wide agent instructions live in [`../AGENTS.md`](../AGENTS.md). That file is the mandatory entry point and contains the non-negotiable greenfield and hard-cutover policy.

## Fast reading paths

| Goal | Read |
| --- | --- |
| Orient to the repository | [Project status](project/status.md), then [Stack](architecture/stack.md) |
| Understand the product and current content | [Product brief](product/brief.md), [Skeleton-viewer specification](product/skeleton-viewer.md), then [Draw game](product/draw-game.md) |
| Implement or modify behavior | [Engineering standards](engineering/standards.md), [Testing strategy](engineering/testing.md), [Workflow](engineering/workflow.md) |
| Measure pose stability or evaluate a pose model | [Pose quality](engineering/pose-quality.md), then [ADR-0011](decisions/0011-consumer-specific-pose-stability.md) |
| Make an architectural choice | [Architecture overview](architecture/overview.md), [ADR index](decisions/README.md) |
| Select tools or run commands | [Stack](architecture/stack.md) |
| Find or add future work | [Backlog](project/backlog.md) |
| Understand major completed milestones | [Milestone log](project/milestones.md) |

## Directory map

```text
docs/
├── README.md                         # This index and documentation contract
├── product/
│   ├── brief.md                      # Users, purpose, constraints, and non-goals
│   ├── skeleton-viewer.md            # First vertical slice contract and implementation map
│   └── draw-game.md                  # First game behavior and acceptance contract
├── architecture/
│   ├── overview.md                  # System shape, boundaries, and data flow
│   └── stack.md                     # Exact technologies, versions, and commands
├── decisions/
│   ├── README.md                    # ADR process and index
│   ├── 0000-template.md             # Copyable ADR template
│   ├── 0001-greenfield-hard-cutover.md
│   ├── 0002-static-peer-to-peer-runtime.md
│   ├── 0003-client-stack-and-renderer-boundary.md
│   ├── 0004-human-readable-pairing-key.md
│   ├── 0005-mirrored-tv-pose-controls.md
│   ├── 0006-session-player-limit-control.md
│   ├── 0007-node-24-and-dependency-maintenance.md
│   ├── 0008-above-head-coarse-hand-controls.md
│   ├── 0009-camera-paced-inference.md
│   ├── 0010-menu-and-draw-game.md
│   ├── 0011-consumer-specific-pose-stability.md
│   └── 0012-two-hand-draw-grip.md
├── engineering/
│   ├── standards.md                 # Design and implementation expectations
│   ├── testing.md                   # Test strategy and required quality gates
│   ├── workflow.md                  # Change lifecycle and review checklist
│   └── pose-quality.md              # One-player pose stability and latency protocol
└── project/
    ├── status.md                    # Current facts, risks, and next decisions
    ├── backlog.md                   # Prioritized actionable work
    └── milestones.md                # Sparse log of durable project milestones
```

## Canonical ownership

- `AGENTS.md` owns mandatory contributor behavior and repository-wide invariants.
- `product/` owns product intent and accepted user-visible behavior.
- `project/status.md` owns volatile current state and near-term risks.
- `project/backlog.md` owns actionable work only until an issue tracker becomes canonical.
- `architecture/stack.md` owns exact tool choices, supported versions, and commands.
- `architecture/overview.md` owns runtime components and their relationships.
- `decisions/` owns why consequential choices were made.
- `engineering/` owns recurring implementation and validation practice.
- `project/milestones.md` records only meaningful completed milestones, not every edit.

Link to the canonical owner instead of copying its content. If two documents claim ownership of the same fact, consolidate them.

## Writing contract

Every maintained document under `docs/` should:

1. Begin with YAML metadata containing at least `status`, `last_verified`, and `scope`.
2. State current truth before rationale or future plans.
3. Use ISO 8601 dates (`YYYY-MM-DD`) and exact paths or commands.
4. Mark unknowns as `Unknown` or `Not selected`; never disguise guesses as facts.
5. Distinguish implemented behavior from proposals and backlog items.
6. Use stable, descriptive headings and short sections that can be retrieved independently.
7. Prefer tables for exact mappings and bullets for discrete rules.
8. Link with repository-relative paths and verify links after moves.
9. Avoid secrets, personal data, transient debugging dumps, chat transcripts, and generated noise.
10. Be updated or deleted in the same hard cutover as the implementation it describes.

Set `status` to one of:

- `Active` — authoritative and currently applicable.
- `Draft` — proposed and not yet authoritative.
- `Template` — a copyable structure, not an active project decision or specification.
- `Superseded` — retained only when historical context is genuinely needed; link to the replacement.
- `Archived` — no longer operational; prefer deletion unless it has durable historical value.

## Adding documentation

Before adding a file, identify why an existing canonical document cannot own the information. New top-level categories require an update to this index. New durable architectural decisions belong in a numbered ADR; temporary investigation notes should normally stay in the task or issue and should not become permanent repository clutter.

Documentation follows the same hard-cutover rule as code: rename references atomically, update all links, and delete the obsolete document. Do not leave redirect files or duplicate “old” instructions unless explicitly required.
