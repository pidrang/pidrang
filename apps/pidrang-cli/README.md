# pidrang

The `pidrang` CLI (`npx pidrang init`): scaffolds a `Resource` + working CRUD pages from a Supabase table, run from the root of an existing Angular app.

## `pidrang init`

Run from the root of an Angular 22.1 (or later 22.x) standalone app. It wires `@pidrang/cli`'s wizard to `@pidrang/cli-supabase`'s Supabase provider (the only registered provider today). `pidrang --help` lists the options.

Before any question, it reads `angular.json` and picks the single application, or the one `--project <name>` names. That application's `sourceRoot` gives the app folder (`src/app` for a new app), and the folder must hold `app.config.ts` and `app.routes.ts`. Anything else stops it with the reasons and nothing written. Then it writes into the app folder:

- `resources.ts` — the generated `Resource[]`
- `pages/{not-found,resource-list,resource-create,resource-show,resource-edit}-page.ts` and `pidrang/` (the page state functions, route guard and helpers those pages and the routes snippet import, plus an `index.ts` barrel) — the generic `@pidrang/material` CRUD pages

Every file is checked before the first write. If one already exists with other content (an edited page, files from an older pidrang, a `resources.ts` from other answers), init lists them all and writes nothing. An identical file is left as it is, so a second run with the same answers writes nothing. A file is never overwritten.

`pidrang init --plan plan.json` takes the answers from a JSON file instead of prompts and the credentials from environment variables; see `docs/getting-started.md`. A table named like a route `app.routes.ts` already declares is refused in both modes.

It never edits the app's own `app.routes.ts`/`app.config.ts`. It prints the routes snippet and the `provideRouter(routes, withComponentInputBinding())` and `providePidrang({...})` calls to paste in manually, and warns when `app.config.ts` does not mention `withComponentInputBinding` yet, since the pages stay blank without it. It also prints the optional `provideSignInPath(...)` provider: without it, the pages ask the user to sign in as plain text; with it, that text links to the app's own sign-in route.

Exit status: `0` when done or when nothing is left to write, `1` on invalid input, an unsupported app or a file in the way, `130` when cancelled. When writing stops half way, it lists what it wrote and what is left; running it again with the same answers finishes.

`preflightApp`, `planWrites`, `applyWritePlan` and `relocateFiles` are exported from the package, for a tool that wants the same checks.

## Packaging

`pidrang`, `@pidrang/cli` and `@pidrang/cli-supabase` are prepared for npm but not published yet (tracked in #25 and #57). `pnpm run verify:artifacts` packs them, installs the tarballs in an empty directory and runs the installed `pidrang` binary, so the published package is tested without workspace links. See `docs/releasing.md`.

## Running unit tests

Run `nx test pidrang-cli` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build pidrang-cli` to build the app.
