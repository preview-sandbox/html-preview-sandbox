# Branching & Release Management

This project uses a **trunk-based** model with tag-triggered releases. It is
intentionally simple so a small team (or a single maintainer) can keep it green
and shippable at all times.

## Branches

| Branch | Purpose | Rules |
|--------|---------|-------|
| `main` | The single long-lived branch. Always releasable, always green. | Target policy: changes land via PR; CI must pass; at least one review when more than one maintainer exists. Configure the repository ruleset described below before relying on this guarantee. |
| `feat/<topic>` | New features | Branch from `main`, open a PR back into `main`. |
| `fix/<topic>` | Bug fixes | Same as above. |
| `docs/<topic>` | Documentation-only changes | Same as above. |
| `chore/<topic>` | Tooling, deps, CI | Same as above. |

Security fixes are developed privately (see [Security Fixes](#security-fixes)),
not on public branches, until an advisory is ready.

## Pull Request Flow

1. Branch from up-to-date `main`.
2. Make the change; keep it focused (unrelated refactors go in separate PRs).
3. Run the local gate: `npm run check && npm run test:browser && npm run test:electron`.
   `check` includes a consumer smoke test against the actual npm tarball, not only
   source-tree imports. Run `npm run audit` before a release or dependency update.
4. Open a PR. The template checklist must pass, including:
   - independent-implementation boundary respected;
   - security-affecting changes carry regression tests and fixtures;
   - docs updated and consistent with actual behavior.
5. CI runs formatting, lint, type check, Node tests, browser tests, the real-process
   Electron example smoke test, build, `pack:dry`, and a consumer smoke test against
   the packed Node, browser, and React exports.
6. Squash-merge into `main` once green and reviewed.

## Versioning

Semantic Versioning. During `0.x` the public API may change between **minor**
versions — breaking changes are allowed but must be called out in the PR and in
`CHANGELOG.md`. After the API stabilizes, cut `1.0.0` and follow strict SemVer.

- **patch** (`0.1.0 → 0.1.1`): bug fixes, security fixes, doc-only shipped changes.
- **minor** (`0.1.x → 0.2.0`): new features; in `0.x`, also allowed breaking changes.
- **major** (`→ 1.0.0` and beyond): first stable API; thereafter breaking changes only.

## Release Process

Releases are automated by [`.github/workflows/release.yml`](../.github/workflows/release.yml),
triggered by pushing a `v*` tag. To cut a release:

1. Ensure `main` is green and `CHANGELOG.md` has the release notes under a new
   version heading (move items out of `Unreleased`).
2. Bump `version` in `package.json` to match (e.g. `0.1.1`).
3. Commit: `chore: release v0.1.1`.
4. Tag and push:
   ```bash
   git tag v0.1.1
   git push origin main --tags
   ```
5. The release workflow runs the full test suite, verifies the tag matches
   `package.json` version, and publishes to npm with `--provenance`.

The tag/version consistency check will fail the release if the `v*` tag does not
match `package.json`, preventing accidental mismatched publishes.

### Prerequisites (one-time repository setup)

Confirm the identity triple matches everywhere before the first publish:

- GitHub org: `preview-sandbox`
- GitHub repo: `html-preview-sandbox`
- npm package: `html-preview-sandbox`

Then set up the repository:

```bash
git remote add origin git@github.com:preview-sandbox/html-preview-sandbox.git
```

- [ ] Migrate npm publishing from the current `NPM_TOKEN` secret to npm Trusted
      Publishing (OIDC). Configure npm with org `preview-sandbox`, repository
      `html-preview-sandbox`, and workflow filename `release.yml`; update the
      release runner to Node 24/npm 11.5.1+ before removing the token.
- [ ] GitHub Security Advisories enabled (private vulnerability reporting).
- [ ] `main` branch protection: require PRs, require CI to pass, and require review once there is more than one maintainer.
- [ ] Immutable Releases enabled for future GitHub Releases.
- [x] CI (`ci.yml`) and the release workflow (`release.yml`) present on the default branch.

The project does not currently run CodeQL. Do not list code scanning as a
required check unless it has been enabled and verified for the repository.

## Security Fixes

Do **not** open public issues, PRs, or branches for vulnerabilities. Follow
[SECURITY.md](../SECURITY.md): report privately via GitHub Security Advisories.
Fixes are developed in the advisory's temporary private fork, then merged to
`main` and released as a patch version alongside the published advisory.

## Changelog

`CHANGELOG.md` is maintained manually in [Keep a Changelog](https://keepachangelog.com/)
format. Every user-facing change adds an entry under `Unreleased`; cutting a
release moves those entries under the new version heading. (Adopting an automated
tool such as changesets is an open question in [ROADMAP.md](ROADMAP.md) but is not
needed while the project has a single maintainer.)
