# Contributing to Pidrang

Thank you for considering contributing to Pidrang.

## Questions and ideas

Ask questions and share ideas in [GitHub Discussions](https://github.com/pidrang/pidrang/discussions). Open an issue for a reproducible bug or a concrete feature request, using the templates. Report security problems privately, as described in [`SECURITY.md`](./SECURITY.md).

## Local setup

Requirements: Node.js 22.22.3 or later, and pnpm (the exact version is pinned in `packageManager`; `corepack enable` picks it up).

```bash
git clone https://github.com/pidrang/pidrang.git
cd pidrang
pnpm install
pnpm exec nx serve demo-material
```

The demo apps talk to the hosted `pidrang` Supabase project by default. To run against a local Supabase instance instead:

```bash
# in a clone of pidrang/supabase
supabase start

# in this repo
pnpm exec nx serve demo-material --configuration=local
```

## Before opening a pull request

```bash
pnpm exec nx run-many -t lint test build
```

This is the same command CI runs. To limit it to one project, use `-p`, for example `pnpm exec nx run-many -t lint test -p core`.

## Architecture rule

`@pidrang/core` depends on `@angular/core` only: no component library, no `@angular/common`, `@angular/forms`, `@angular/platform-browser` or `@angular/router`. A change that seems to need one of those belongs in a UI package. See [`docs/architecture.md`](./docs/architecture.md).

## Code style

- Follow the official Angular conventions: standalone APIs, signals over `Observable` state, `inject()` over constructor injection.
- Add or update tests next to the code they cover.

## Branching

- `main` is always releasable.
- Work happens on short-lived branches: `feat/*` for features and packages, `fix/*` for bug fixes, `docs/*` for documentation, `chore/*` for tooling.
- Open a pull request against `main`. CI must pass before merging.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). The release tooling reads them to decide the next version and to build the changelog, so the type matters:

- `feat(core): add getList provider contract`
- `fix(supabase): handle null response in update`
- `docs: update README roadmap`

Use `feat` for new behavior, `fix` for bug fixes, and add `!` after the scope (for example `feat(core)!: rename injectResource`) or a `BREAKING CHANGE:` footer for breaking changes. Scopes are package names without the `@pidrang/` prefix: `core`, `supabase`, `material`, `tailwind`, `cli`, `cli-supabase`.
