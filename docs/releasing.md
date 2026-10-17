# Releasing

How a new version of the published packages reaches npm. Maintainers only.

## Model

- **Published packages:** the four libraries `@pidrang/core`, `@pidrang/supabase`, `@pidrang/material`, `@pidrang/tailwind`, and the three CLI packages `@pidrang/cli`, `@pidrang/cli-supabase` and `pidrang` (the bin, Nx project `pidrang-cli`).
- **One version for all seven packages** (a fixed release group). Every release bumps and publishes all of them to the same number, so users never have to work out which `@pidrang/material` goes with which `@pidrang/core`.
- **Tool:** [Nx Release](https://nx.dev/features/manage-releases), configured under `release` in `nx.json`.
- **Version source:** Conventional Commits since the last `vX.Y.Z` tag. From 1.0.0 on, `feat` bumps minor, `fix` bumps patch and a breaking change (`!` or a `BREAKING CHANGE:` footer) bumps major. Below 1.0.0 each level shifts down: a breaking change bumps minor, and `feat` and `fix` bump patch. The `Release` workflow takes the exact version (`0.1.0`), because the gate packs and tests the tarballs at that version before anything is tagged; use the local dry run below to see which version the commits call for.
- **Changelog:** `CHANGELOG.md` at the repository root, generated from the same commits, plus a GitHub Release for each tag.

## Semver rules

- Below 1.0.0, minor releases may contain breaking changes and patch releases never do.
- From 1.0.0 on, breaking changes only ship in a major release.
- Adding support for a new Angular major is a minor release. Dropping the previous one is a breaking change.
- `@pidrang/supabase`, `@pidrang/material` and `@pidrang/tailwind` declare `@pidrang/core` as a peer dependency. In the source tree it is `workspace:*`; during a release Nx rewrites it, in the published manifest only, to a caret range of the release version (`^0.2.0`). Below 1.0.0 a caret range allows patch updates only, so a package pinned to `^0.2.0` core does not accept core `0.3.0`. That is intentional: the fixed group guarantees the packages are released together. The same rewrite applies to `@pidrang/cli-supabase` and `pidrang`, which depend on `@pidrang/cli` and `@pidrang/core`.

## Cutting a release

Releases run from the `Release` GitHub Actions workflow on `main`, never from a laptop. It runs four jobs, each only when the previous one passed:

1. `check` refuses a version that is not exact (`0.1.0` or `0.2.0-rc.1`).
2. `gate` runs the full [release gate](#the-release-gate) at that version and uploads the tested tarballs as the `release-gate-<commit>` artifact.
3. `tag` downloads the artifact, checks it with `verify-identities.mjs --version --commit`, lints and tests, then runs `nx release <version> --skip-publish`. That builds the packages, writes the version to each `package.json`, prepends the new section to `CHANGELOG.md`, commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, pushes both and creates the GitHub Release. It publishes nothing.
4. `publish` runs in the `npm` environment. It downloads the same artifact and runs `tools/release-gate/publish.mjs`, which checks the artifact again and publishes the seven tested tarballs with `npm publish <tarball> --access public --provenance`, in dependency order: core, supabase, material, tailwind, cli, cli-supabase, then `pidrang` last. A version with a `-` goes to the `next` tag, any other one to `latest`.

The tagged commit differs from the tested commit only by the version bump and the changelog: the gate packed the tarballs from the tested commit with the same `nx release version` rewrite, so their manifests already hold the release version and the caret ranges.

Steps:

1. Make sure `main` is green and contains everything meant for the release.
2. Open Actions, Release, Run workflow on `main` and enter the version. Leave `dry-run` checked first and read the log: the gate result, the version and changelog entry of the `tag` job, and the `npm publish --dry-run` output of each package in the `publish` job.
3. Run it again with `dry-run` unchecked.
4. Check the tag, the GitHub Release and the npm pages, including the provenance badge on each package page.

For the very first release, set `first-release`, because no version tag exists yet.

To preview locally, without committing, tagging, pushing or publishing:

```bash
pnpm exec nx release --skip-publish --dry-run
```

Do not run `nx release` without `--dry-run` on a laptop: it commits, tags, pushes and publishes.

## Verifying the artifacts

`pnpm run verify:artifacts` runs before every release, and every pull request runs the same checks through the build mode of the [release gate](#the-release-gate). It checks what would actually be published, not the source tree:

1. builds all seven packages (the four libraries and the three CLI packages) and runs the real `nx release version` step, so the internal `workspace:*` dependencies are rewritten exactly as in a release,
2. packs each package with `npm pack` (`tools/pack-packages.mjs`),
3. `tools/check-tarballs.mjs` inspects the tarballs: no `workspace:`, `file:` or `link:` dependency, a shared version, `README` and `LICENSE` present, every `main`, `types`, `exports` and `bin` target present, a shebang on the binary, no test files, environment files, caches or credential-like strings, and source maps only when they embed their sources,
4. `tools/check-install.mjs` installs all the tarballs together in an empty directory, compiles a file importing the four Angular packages through their package exports, imports the libraries at runtime, and runs the installed `pidrang` binary (usage and start of `init`).

The script restores `nx.json`, the package manifests and `pnpm-lock.yaml` when it finishes, so it is safe to run locally. It needs network access to install the peer dependencies from the registry.

## The release gate

`tools/release-gate/run.mjs` tests the tarballs as an application installs them. It never uses the source tree, tsconfig paths or pnpm workspace links.

- `--mode build` (every pull request):
  1. packs the seven packages at one version (`0.0.0-gate.<commit>` by default, `--version` to choose) into `tmp/release-gate/tarballs`, and runs the tarball and install checks above on them;
  2. writes `tmp/release-gate/identities.json`: name, version, size and sha256 of each tarball, the source commit and the Node, npm and pnpm versions;
  3. copies `tools/release-gate/consumers/material` and `tools/release-gate/consumers/tailwind` (two small Angular 22 apps with strict templates) to an empty directory outside the repository, and installs the tarballs there with npm, along with the Angular, Material, Supabase and Tailwind versions of the root `package.json`;
  4. in the Material app, generates `resources.ts`, the CRUD pages and the resource routes with the functions of the installed `@pidrang/cli`, from `tools/release-gate/generation-plan.json` (there is no database to read in this mode);
  5. runs `ng build` on both apps. The Tailwind build must contain the utility classes listed in `tools/release-gate/tailwind-classes.json`, which only exist when the `@source` line reaches the installed `@pidrang/tailwind`;
  6. records each app's installed versions in `identities.json` and keeps its `package-lock.json`.
- `--mode full` (the `Release gate` workflow, on every push to `main`, before every release, and on pull requests from branches of this repository) does the same against a local Supabase stack, except that the Material app is generated by the installed `pidrang` binary: `pidrang init --plan` with the service-role strategy and the stack's key in `PIDRANG_SUPABASE_SERVICE_ROLE_KEY`, and the tables, actions and hidden fields of `generation-plan.json`. The gate fails when the `resources.ts` the binary writes differs from the one the functions write from `generation-plan.json`, so the plan of the build mode follows the real schema. Then it:
  1. runs Playwright on both apps and both demos (`tools/release-gate/e2e`), each served by the gate on its own port. A test fails if the page sends a request to any host but `127.0.0.1`, `localhost` or `[::1]`. The fixtures are reloaded before each test, and the tests run one at a time;
  2. runs the Supabase provider conformance suite and fails unless every conformance test ran and passed;
  3. records the pidrang/supabase commit and `gate: { mode: 'full', passed: true }` in `identities.json`, then checks the tarballs against it again. Each run deletes `tmp/release-gate` before its first check, so a run that stops at any step leaves no manifest, or one with `passed: false`.

The browser tests cover:

- the list up to row eleven on page two;
- create, show, edit and delete as the fixture writer;
- delete confirmation;
- a failed delete retried;
- a refused delete;
- a write that row-level security refuses;
- the anonymous sign-in prompt and its link;
- the action flags;
- unknown resources next to an app route declared after the resource routes;
- route input binding;
- the Material theme and the Tailwind styles.

Pull requests from forks and from Dependabot skip the full mode: they cannot read the `SUPABASE_FIXTURES_TOKEN` secret. GitHub counts a skipped job as passed, so a maintainer runs the full gate locally before merging one that touches what the gate tests. A new push to a pull request cancels its running full gate; runs on `main` and in a release are never cancelled.

Both workflows (`CI` in build mode, `Release gate` in full mode) upload `tmp/release-gate` (tarballs, manifest, build logs, Playwright report and traces of failed tests) as an artifact, even when it fails.

### Running it locally

1. Clone [pidrang/supabase](https://github.com/pidrang/supabase) at the commit in `tools/release-gate/supabase-fixtures.ref`.
2. Start its stack with the CLI version the repository pins: `npx -y "supabase@$(cat supabase/.cli-version)" start`. If that clone is linked to the hosted project, `supabase/.temp` pins the hosted service versions, and some of those images are not published; add `-x storage-api,imgproxy`, the gate does not need them.
3. In this repository:
   ```bash
   PIDRANG_SUPABASE_DIR=../supabase node tools/release-gate/run.mjs --mode full
   ```

The gate stops early when the pidrang/supabase clone is not at the pinned commit or has local changes, and when the demos' `environment.local.ts` does not hold the running stack's publishable key, so a stack started by another CLI version fails too. The gate runs every `supabase` command, including the ones in the fixture scripts, through the CLI version pinned in `supabase/.cli-version`, whatever is installed globally. It takes about six minutes and needs ports 4310, 4311, 4320 and 4321 free.

A local run on a working tree with uncommitted or untracked files can pass, but it says that it cannot be published: its last check runs `verify-identities.mjs --allow-dirty`. In CI (`CI=true`) the same run fails.

### Publishing what the gate tested

`node tools/release-gate/verify-identities.mjs <directory>` fails unless `<directory>/identities.json` records a passed full gate run on a clean working tree, with one tarball of each of the seven packages, all at the version the gate packed. With `--version <version>` and `--commit <sha>` it also fails when the manifest records another version or commit. It then re-hashes the tarballs in `<directory>/tarballs` and fails when any of them differs from the manifest in name, version, size or content, or when one was not tested.

`node tools/release-gate/publish.mjs <directory> --version <version> --commit <sha> [--dry-run]` runs that check with both options and publishes nothing when it fails. The `Release` workflow publishes only through it, so `nx release` never packs the packages again. Before each package it reads the integrity npm records for that exact version: it publishes when the version is not on npm, skips it when npm holds the same tarball, and stops when npm holds a different one.

The workflow checks out pidrang/supabase with the `SUPABASE_FIXTURES_TOKEN` secret: a fine-grained token with read-only access to the contents of that repository.

## One-time setup

- The `@pidrang` organization exists on npm. Make sure the publishing account is a member with publish rights. An organization does not reserve the unscoped `pidrang` package name used by the CLI: check that `npm view pidrang` returns 404 before the CLI release.
- Add an npm token as the `NPM_TOKEN` repository secret. It must be able to publish the `@pidrang` scope and the unscoped `pidrang` package. npm is restricting tokens that bypass two-factor authentication, so read its current guidance before creating one, and prefer trusted publishing from GitHub Actions (OIDC) once the packages exist. The `publish` job already grants `id-token: write` and installs npm 11.21.1.
- The `publish` job runs in the `npm` environment. GitHub creates it on the first run if it does not exist; add required reviewers to it to approve each publish by hand.
- Provenance requires a public repository. Make the repository public before the first publish.
- If `main` is protected, allow the release workflow's `github-actions[bot]` to push to it, or the `chore(release)` commit and tag push will be rejected.

## If something goes wrong

- **Publish failed after the tag was pushed:** npm versions cannot be reused once published, but a version that never reached npm can be published again. Use Re-run failed jobs on the same workflow run: only `publish` runs again, with the same artifact, and it skips the packages npm already holds with the same content. Do not create a new version. The artifact is kept 30 days.
- **The `tag` job failed after pushing the tag** (for example while creating the GitHub Release): `publish` does not run, and re-running `tag` fails because the tag already exists. The workflow has no automated recovery for this case yet: create the GitHub Release by hand from the `CHANGELOG.md` section and open an issue before publishing that version.
- **A bad version reached npm:** publish a fixed patch version and, if needed, `npm deprecate` the bad one. Avoid `npm unpublish`.
- **Wrong changelog entry:** edit `CHANGELOG.md` and the GitHub Release by hand in a follow-up commit.
