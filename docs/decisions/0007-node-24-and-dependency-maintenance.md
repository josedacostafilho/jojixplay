---
status: Active
last_verified: 2026-08-13
scope: Toolchain baseline, dependency update policy, continuous validation, and deployment permissions
---

# ADR-0007: Node 24 and dependency maintenance

- **Status:** Accepted
- **Date:** 2026-08-13
- **Decision owners:** Project owner
- **Supersedes:** The Node 22 toolchain baseline
- **Superseded by:** None

## Context

The repository was initialized on Node 22.22.0. The current jsdom 30 release requires at least Node 24.15.0 on the Node 24 line, Node 24 is the current long-term-support baseline, and the newest first-party GitHub Actions releases execute on Node 24. Dependabot opened separate upgrades for jsdom and four workflow actions, but the current deployment workflow does not run on pull requests. Merging those pull requests independently would test only after each change reached `main` and would create unnecessary deployment noise.

The project is greenfield and explicitly forbids preserving an obsolete toolchain. Dependency automation should produce reviewable, validated batches without weakening major-upgrade scrutiny or supply-chain integrity.

## Decision

### Hard toolchain cutover

- Use exactly Node.js **24.19.0 LTS** in the version file and continuous integration, npm **11.17.0** as the package-manager contract, jsdom **30.0.1**, and Node 24 type declarations.
- Support only the Node 24 major line at or above the pinned baseline. Remove Node 22 declarations, workflow setup, documentation, and compatibility behavior in the same change.
- The committed lockfile is generated and validated with the selected Node/npm toolchain. Local and CI commands remain identical.

### GitHub Actions and validation

- Upgrade `actions/checkout` to v7, `actions/setup-node` to v7, `actions/configure-pages` to v6, and `actions/deploy-pages` to v5. Keep `actions/upload-pages-artifact` on v5.
- Pin every third-party workflow action to the immutable full commit SHA corresponding to the reviewed release, with its semantic release in a same-line comment so Dependabot can maintain both.
- Run the complete canonical validation suite for pull requests, pushes to `main`, and manual validation. Only a validated `main` build may configure Pages, upload the production artifact, and deploy.
- Keep read-only repository permission as the workflow default. Grant Pages and identity-token write permissions only to the jobs that publish or deploy.

### Dependabot and repository security

- Keep weekly npm and GitHub Actions version checks.
- Group all GitHub Actions version updates into one pull request. Group routine npm minor/patch updates by production or development dependency type; keep npm major updates separate for intentional review.
- Enable Dependabot vulnerability alerts and security updates for the public repository. Security updates remain distinct from scheduled version-update grouping and must receive priority review.
- Supersede the five initial bot pull requests with one coherent, fully validated cutover rather than retaining intermediate compatibility states.

## Implementation and validation plan

1. Add the canonical Node version file and update package metadata, documentation, type declarations, jsdom, npm metadata, and the lockfile together.
2. Split validation from publication conditions, pin all actions by reviewed SHA, and ensure pull requests cannot invoke Pages deployment.
3. Configure useful Dependabot groups without automatically merging any update class.
4. Run install, formatting, linting, type analysis, unit/component tests, vendored-asset verification, production builds, Chromium end-to-end tests, and the high-severity dependency audit under Node 24.19.0/npm 11.17.0.
5. Publish the coherent change, verify the pull-request/main workflows and live Pages deployment, enable repository security settings, and close or confirm automatic closure of the superseded bot pull requests.

## Consequences

### Benefits

- The local contract, test DOM, first-party Actions runtime, and CI toolchain share one supported LTS generation.
- Pull requests receive the same fail-closed validation used before deployment.
- Immutable action references reduce the risk of a moved tag changing executable CI code without review.
- Grouping lowers update noise while leaving consequential npm major changes individually visible.

### Costs and risks

- Contributors must install the selected Node 24 baseline; Node 22 is intentionally unsupported.
- Full pull-request validation installs Chromium and is slower than a build-only check, but it protects the actual release contract.
- Grouped updates require reviewing the combined diff and test result rather than assuming every update is independently safe.

## Alternatives considered

### Raise Node 22 only enough for jsdom 30

Rejected because it would retain a maintenance-line baseline while the project and first-party actions can use the current LTS generation with no compatibility obligation.

### Merge each Dependabot pull request directly

Rejected because the changes form one toolchain/workflow cutover and the original pull requests have no pre-merge validation.

### Keep mutable action major tags

Rejected because an immutable full SHA is the stronger supply-chain boundary and remains maintainable by Dependabot.

## Verification

- `node --version` and `npm --version` match the canonical version files and package metadata during local and CI validation.
- Pull requests run the full suite without a deploy job; `main` runs the suite, builds for the repository base path, and deploys only after success.
- Workflow inspection finds no mutable external action references.
- Dependabot configuration validation and subsequent update pull requests demonstrate the intended grouping.
- GitHub repository settings report vulnerability alerts and security updates enabled.

## Follow-up

- Replace this baseline through a future hard cutover when the selected Node line no longer satisfies the project's current-support policy.
