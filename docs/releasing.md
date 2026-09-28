# Releasing

How a new version of the published packages reaches npm. Maintainers only.

## Model

- **Published packages:** `@pidrang/core`, `@pidrang/supabase`, `@pidrang/material`, `@pidrang/tailwind`. The CLI packages (`@pidrang/cli`, `@pidrang/cli-supabase`, `pidrang-cli`) are private and not released yet.
- **One version for all four packages** (a fixed release group). Every release bumps and publishes all of them to the same number, so users never have to work out which `@pidrang/material` goes with which `@pidrang/core`.
- **Tool:** [Nx Release](https://nx.dev/features/manage-releases), configured under `release` in `nx.json`.
- **Version source:** Conventional Commits since the last `vX.Y.Z` tag. From 1.0.0 on, `feat` bumps minor, `fix` bumps patch and a breaking change (`!` or a `BREAKING CHANGE:` footer) bumps major. Below 1.0.0 each level shifts down: a breaking change bumps minor, and `feat` and `fix` bump patch. An exact version or a keyword (`patch`, `minor`, `major`) can be passed to override it.
- **Changelog:** `CHANGELOG.md` at the repository root, generated from the same commits, plus a GitHub Release for each tag.

## Semver rules

- Below 1.0.0, minor releases may contain breaking changes and patch releases never do.
- From 1.0.0 on, breaking changes only ship in a major release.
- Adding support for a new Angular major is a minor release. Dropping the previous one is a breaking change.
- `@pidrang/supabase`, `@pidrang/material` and `@pidrang/tailwind` declare `@pidrang/core` as a peer dependency. In the source tree it is `workspace:*`; during a release Nx rewrites it, in the published manifest only, to a caret range of the release version (`^0.2.0`). Below 1.0.0 a caret range allows patch updates only, so a package pinned to `^0.2.0` core does not accept core `0.3.0`. That is intentional: the fixed group guarantees the four packages are released together.

## Cutting a release

Releases run from the `Release` GitHub Actions workflow, never from a laptop. The workflow lints, tests and builds, then runs `nx release`, which:

1. builds the packages with `tools/build-packages.mjs` and copies `LICENSE` into each `dist` folder,
2. computes the new version and writes it to each `package.json` and its `dist` copy,
3. prepends the new section to `CHANGELOG.md`,
4. commits `chore(release): vX.Y.Z`, tags `vX.Y.Z` and pushes both,
5. creates the GitHub Release,
6. publishes to npm with provenance.

Steps:

1. Make sure `main` is green and contains everything meant for the release.
2. Open Actions, Release, Run workflow on `main`. Leave `dry-run` checked first and read the log: version, changelog entry, files that would be published.
3. Run it again with `dry-run` unchecked.
4. Check the tag, the GitHub Release and the npm pages, including the provenance badge on each package page.

For the very first release, set `first-release` and pass an exact version (`0.1.0`), because no version tag exists yet to compute one from.

To preview locally, without committing, tagging, pushing or publishing:

```bash
pnpm exec nx release --dry-run
```

Do not run `nx release` without `--dry-run` on a laptop: it commits, tags, pushes and publishes.

## Verifying the artifacts

`pnpm run verify:artifacts` runs on every pull request and before every release. It checks what would actually be published, not the source tree:

1. builds all seven packages (the four libraries and the three CLI packages) and runs the real `nx release version` step, so the internal `workspace:*` dependencies are rewritten exactly as in a release,
2. packs each package with `npm pack` (`tools/pack-packages.mjs`),
3. `tools/check-tarballs.mjs` inspects the tarballs: no `workspace:`, `file:` or `link:` dependency, a shared version, `README` and `LICENSE` present, every `main`, `types`, `exports` and `bin` target present, a shebang on the binary, no test files, environment files, caches or credential-like strings, and source maps only when they embed their sources,
4. `tools/check-install.mjs` installs all the tarballs together in an empty directory, compiles a file importing the four Angular packages through their package exports, imports the libraries at runtime, and runs the installed `pidrang` binary (usage and start of `init`).

The script restores `nx.json`, the package manifests and `pnpm-lock.yaml` when it finishes, so it is safe to run locally. It needs network access to install the peer dependencies from the registry.

Only the four libraries are in the `nx.json` release group. The three CLI packages are prepared and verified but not released until #57; the verification temporarily includes them so their tarballs are checked too.

## One-time setup

- The `@pidrang` organization exists on npm. Make sure the publishing account is a member with publish rights. An organization does not reserve the unscoped `pidrang` package name used by the CLI: check that `npm view pidrang` returns 404 before the CLI release.
- Add an npm token as the `NPM_TOKEN` repository secret, limited to the `@pidrang` scope. npm is restricting tokens that bypass two-factor authentication, so read its current guidance before creating one, and prefer trusted publishing from GitHub Actions (OIDC) once the packages exist. The workflow already grants `id-token: write`.
- Provenance requires a public repository. Make the repository public before the first publish.
- If `main` is protected, allow the release workflow's `github-actions[bot]` to push to it, or the `chore(release)` commit and tag push will be rejected.

## If something goes wrong

- **Publish failed after the tag was pushed:** npm versions cannot be reused once published, but a version that never reached npm can be published again. Re-run the publish for the same tag; do not create a new version.
- **A bad version reached npm:** publish a fixed patch version and, if needed, `npm deprecate` the bad one. Avoid `npm unpublish`.
- **Wrong changelog entry:** edit `CHANGELOG.md` and the GitHub Release by hand in a follow-up commit.
