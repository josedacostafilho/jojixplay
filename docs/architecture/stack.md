---
status: Active
last_verified: 2026-08-13
scope: Canonical technologies, supported versions, and developer commands
---

# Stack and command registry

## Current stack

The following versions implement the prototype. `package-lock.json` is authoritative for the exact transitive dependency graph.

| Layer or concern | Canonical choice | Supported version | Evidence / command |
| --- | --- | --- | --- |
| Runtime language | TypeScript | 7.0.2 | `npm run typecheck` |
| Runtime baseline | Node.js for tooling only | 22.22.0 or compatible Node 22 | `node --version` |
| Application framework | Browser SPA | Native ES modules | `npm run build` |
| UI framework | Preact | 10.29.8 | `npm ls preact` |
| Package manager | npm | 11.16.0 lockfile format | `npm --version` |
| Build tool | Vite with Preact preset | 8.2.1 / 2.10.6 | `npm run build` |
| Pose inference | MediaPipe Tasks Vision | 1.0.1 | Vendored Lite model and generated runtime assets |
| Peer rendezvous/transport | Trystero default Nostr strategy / WebRTC | 0.25.3 | `npm ls trystero` |
| QR generation | `qrcode` | 1.5.4 | TV-only dynamic import |
| Formatter | Biome | 2.5.8 | `npm run format` |
| Linter | Biome | 2.5.8 | `npm run lint` |
| Static/type checker | TypeScript | 7.0.2 | `npm run typecheck` |
| Unit/component test runner | Vitest / Testing Library | 4.1.10 / 3.2.4 | `npm test` |
| End-to-end tooling | Playwright | 1.62.1 | `npm run test:e2e` |
| Database and migration tool | None | — | Persistence is forbidden for this slice |
| CI provider | GitHub Actions | Current major actions pinned in workflow | `.github/workflows/pages.yml` |
| Deployment/runtime platform | GitHub Pages | Static project site | `npm run build` |
| Observability tooling | None external | — | Local status UI only |

## Canonical commands

These commands are executable and are the only canonical paths for their concerns.

| Purpose | Command |
| --- | --- |
| Install dependencies | `npm ci` |
| Start local development | `npm run dev` |
| Format | `npm run format` |
| Check formatting | `npm run format:check` |
| Lint | `npm run lint` |
| Static/type analysis | `npm run typecheck` |
| Run unit tests | `npm test` |
| Run integration tests | `npm test` |
| Run end-to-end tests | `npm run test:e2e` |
| Run the full validation suite | `npm run validate` |
| Build a production artifact | `npm run build` |
| Verify vendored model integrity | `npm run verify:assets` |
| Audit dependencies | `npm run audit` |
| Apply database migrations | Not applicable yet |

`npm run test:e2e` first builds the production artifact and then serves it through Vite preview. The browser suite therefore exercises the same asset layout used for deployment, including the vendored MediaPipe model and WebAssembly files.

## Static artifact and deployment

- `npm run build` writes the root-hosted artifact to `dist/`.
- `BASE_PATH=/jojixplay/ npm run build` writes an artifact whose asset URLs target a GitHub Pages project path. Replace `jojixplay` only if the repository name changes.
- `.github/workflows/pages.yml` validates on every push to `main`, rebuilds with `/${repository-name}/` as the base, and deploys through GitHub Pages.
- The production artifact is published at `https://josedacostafilho.github.io/jojixplay/`; GitHub Actions is the configured Pages source.
- Rollback is a new deployment of the chosen earlier Git commit. Do not keep an alternate runtime or compatibility path in the application.

## Selection criteria

Choose tools against confirmed product and deployment requirements. Prefer:

- current, supported stable releases;
- strong type and static-analysis support where it improves correctness;
- deterministic builds and first-class CI behavior;
- healthy maintenance, clear security practices, and a sustainable ecosystem;
- good test ergonomics, diagnostics, accessibility support, and observability;
- the fewest tools and overlapping abstractions necessary for the product;
- one canonical package manager, formatter, linter, and test path.

Do not select technology solely because it is familiar or fashionable. Do not introduce an outdated version to preserve hypothetical compatibility. Avoid preview releases unless a documented requirement needs them and the risk is accepted in an ADR.

## Updating this registry

A stack-selection or replacement change must:

1. Record consequential rationale in an ADR.
2. Update this table and every canonical command.
3. Commit deterministic manifests and lockfiles.
4. Configure local and CI validation together.
5. Update examples and onboarding instructions.
6. Remove the displaced tool, configuration, dependencies, scripts, and documentation in the same hard cutover.

Never list multiple interchangeable commands for the same quality gate. If a command is temporarily unavailable, say so explicitly rather than documenting an unverified guess.
