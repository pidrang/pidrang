# pidrang

The `pidrang` CLI (`npx pidrang init`): scaffolds a `Resource` + working CRUD pages from a Supabase table, run from the root of an existing Angular app.

## `pidrang init`

Run from the root of an Angular 22.1 (or later 22.x) standalone app. It wires `@pidrang/cli`'s wizard to `@pidrang/cli-supabase`'s Supabase provider (the only registered provider today). `pidrang --help` lists the options.

Before any question, it reads `angular.json` and picks the single application, or the one `--project <name>` names. That application's `sourceRoot` gives the app folder (`src/app` for a new app), and the folder must hold `app.config.ts` and `app.routes.ts`. Anything else stops it with the reasons and nothing written. Then it writes into the app folder:

- `resources.ts` — the generated `Resource[]`
- `pages/{not-found,resource-list,resource-create,resource-show,resource-edit}-page.ts` and `pidrang/` (the page state functions, route guard and helpers those pages and the routes snippet import, plus an `index.ts` barrel) — the generic `@pidrang/material` CRUD pages
- `pages/sign-in-page.ts` — the sign-in page, with `@pidrang/material` or Tailwind classes depending on whether the app depends on `@pidrang/tailwind`; it imports its helpers from `pidrang/`. Init asks for it on a new app (yes by default) and writes it on an existing app unless the plan has `"signIn": false`; it writes nothing and says why when the plan says no, when `app.routes.ts` already declares a `sign-in` route, or when the file is already there with other content

Every file is checked before the first write. If one already exists with other content (an edited page, files from an older pidrang, a `resources.ts` from other answers), init lists them all and writes nothing. An identical file is left as it is, so a second run with the same answers writes nothing. A file is never overwritten.

Once the files are written, it asks whether to install the packages the generated code imports and the app does not have yet: `@pidrang/core`, `@pidrang/supabase` and `@pidrang/material` pinned to the version of the CLI, `@supabase/supabase-js`, then `ng add @angular/material` when Material is missing. When nothing is missing, it asks nothing. The package manager comes from `cli.packageManager` in `angular.json`, then `packageManager` in `package.json`, then the closest lockfile up to the git root (npm, pnpm, yarn or bun; npm without any). On no, on a failed or interrupted command, with `--skip-install`, with `--plan` or with a package manager it cannot run, it prints the commands still to run instead. An unsupported Node.js stops it before anything else.

`pidrang init --plan plan.json` takes the answers from a JSON file instead of prompts and the credentials from environment variables; see `docs/getting-started.md`. A table named like a route `app.routes.ts` already declares is refused in both modes.

It then wires the app: `providePidrang({...})`, the Supabase client and `withComponentInputBinding()` in `app.config.ts`, `...resourceRoutes` at the top of the routes in `app.routes.ts`, `<router-outlet />` in place of the welcome template of `app.html`, and the environment files when the app has none. The edits go through the app's own `typescript`; a file it cannot edit safely gets a `pidrang:` comment listing the change to make. On a new app (empty routes and the welcome template), it also redirects `/` to the first generated list and offers a navigation layout (`src/app/layout/app-layout.ts`, wired into `app.html`, `app.ts` and `app.spec.ts`). When it writes the sign-in page, it adds `provideSignInPath('/sign-in')` to `app.config.ts`, which the layout's Sign in button and the sign-in prompts of the pages follow. See `docs/getting-started.md`.

## `pidrang generate auth`

Adds the same sign-in page to an app that has none, without asking anything, and wires it the same way: `src/app/pages/sign-in-page.ts`, `...resourceRoutes` in `app.routes.ts` and `provideSignInPath('/sign-in')` in `app.config.ts` when they are missing. It writes nothing and exits `0` when `app.routes.ts` already declares a `sign-in` route or the page is already the one it generates, and exits `1` without writing when the page is there with other content or `app.config.ts` already calls `provideSignInPath` with another path.

Exit status: `0` when done or when nothing is left to write, `1` on invalid input, an unsupported Node.js or app, a file in the way or a failed install, `130` when cancelled. When writing stops half way, it lists what it wrote and what is left; running it again with the same answers finishes.

`preflightApp`, `planWrites`, `applyWritePlan` and `relocateFiles` are exported from the package, for a tool that wants the same checks.

## Packaging

`pidrang`, `@pidrang/cli` and `@pidrang/cli-supabase` are published on npm, released at the same version as the other `@pidrang` packages. `pnpm run verify:artifacts` packs them, installs the tarballs in an empty directory and runs the installed `pidrang` binary, so the published package is tested without workspace links. The release gate also generates the CRUD pages of an Angular app with the installed CLI, builds it and tests it in a browser. See `docs/releasing.md`.

## Running unit tests

Run `nx test pidrang-cli` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build pidrang-cli` to build the app.
