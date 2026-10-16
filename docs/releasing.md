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

## The release gate

`tools/release-gate/run.mjs` tests the tarballs as an application installs them. It never uses the source tree, tsconfig paths or pnpm workspace links.

- `--mode build` (every pull request):
  1. packs the seven packages at one version (`0.0.0-gate.<commit>` by default, `--version` to choose) into `tmp/release-gate/tarballs`, and runs the tarball and install checks above on them;
  2. writes `tmp/release-gate/identities.json`: name, version, size and sha256 of each tarball, the source commit and the Node, npm and pnpm versions;
  3. copies `tools/release-gate/consumers/material` and `tools/release-gate/consumers/tailwind` (two small Angular 22 apps with strict templates) to an empty directory outside the repository, and installs the tarballs there with npm, along with the Angular, Material, Supabase and Tailwind versions of the root `package.json`;
  4. in the Material app, generates `resources.ts`, the CRUD pages and the resource routes with the functions of the installed `@pidrang/cli`, from `tools/release-gate/generation-plan.json` (there is no database to read in this mode);
  5. runs `ng build` on both apps. The Tailwind build must contain the utility classes listed in `tools/release-gate/tailwind-classes.json`, which only exist when the `@source` line reaches the installed `@pidrang/tailwind`;
  6. records each app's installed versions in `identities.json` and keeps its `package-lock.json`.
- `--mode full` (the `Release gate` workflow, on every push to `main` and before every release) does the same against a local Supabase stack, except that the Material app is generated by the installed `pidrang` binary: `pidrang init --plan` with the service-role strategy and the stack's key in `PIDRANG_SUPABASE_SERVICE_ROLE_KEY`, and the tables, actions and hidden fields of `generation-plan.json`. The gate fails when the `resources.ts` the binary writes differs from the one the functions write from `generation-plan.json`, so the plan of the build mode follows the real schema. Then it:
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

Both workflows (`CI` in build mode, `Release gate` in full mode) upload `tmp/release-gate` (tarballs, manifest, build logs, Playwright report and traces of failed tests) as an artifact, even when it fails.

### Running it locally

1. Clone [pidrang/supabase](https://github.com/pidrang/supabase) at the commit in `tools/release-gate/supabase-fixtures.ref`.
2. Start its stack with the CLI version the repository pins: `npx -y "supabase@$(cat supabase/.cli-version)" start`. If that clone is linked to the hosted project, `supabase/.temp` pins the hosted service versions, and some of those images are not published; add `-x storage-api,imgproxy`, the gate does not need them.
3. In this repository:
   ```bash
   PIDRANG_SUPABASE_DIR=../supabase node tools/release-gate/run.mjs --mode full
   ```

The gate stops early when the pidrang/supabase clone is not at the pinned commit or has local changes, and when the demos' `environment.local.ts` does not hold the running stack's publishable key, so a stack started by another CLI version fails too. The gate runs every `supabase` command, including the ones in the fixture scripts, through the CLI version pinned in `supabase/.cli-version`, whatever is installed globally. It takes about six minutes and needs ports 4310, 4311, 4320 and 4321 free.

### Publishing what the gate tested

`node tools/release-gate/verify-identities.mjs <directory>` fails unless `<directory>/identities.json` records a passed full gate, then re-hashes the tarballs in `<directory>/tarballs` and fails when any of them differs from the manifest in name, version, size or content, or when one was not tested. Publishing (#25, #57) must run the gate at the release version, download its artifact and publish those tarballs after this check, rather than letting `nx release` pack them again. Until then, the `Release` workflow only runs the gate first and stops when it fails.

The workflow checks out pidrang/supabase with the `SUPABASE_FIXTURES_TOKEN` secret: a fine-grained token with read-only access to the contents of that repository.

## One-time setup

- The `@pidrang` organization exists on npm. Make sure the publishing account is a member with publish rights. An organization does not reserve the unscoped `pidrang` package name used by the CLI: check that `npm view pidrang` returns 404 before the CLI release.
- Add an npm token as the `NPM_TOKEN` repository secret, limited to the `@pidrang` scope. npm is restricting tokens that bypass two-factor authentication, so read its current guidance before creating one, and prefer trusted publishing from GitHub Actions (OIDC) once the packages exist. The workflow already grants `id-token: write`.
- Provenance requires a public repository. Make the repository public before the first publish.
- If `main` is protected, allow the release workflow's `github-actions[bot]` to push to it, or the `chore(release)` commit and tag push will be rejected.

## If something goes wrong

- **Publish failed after the tag was pushed:** npm versions cannot be reused once published, but a version that never reached npm can be published again. Re-run the publish for the same tag; do not create a new version.
- **A bad version reached npm:** publish a fixed patch version and, if needed, `npm deprecate` the bad one. Avoid `npm unpublish`.
- **Wrong changelog entry:** edit `CHANGELOG.md` and the GitHub Release by hand in a follow-up commit.
