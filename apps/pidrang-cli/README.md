# pidrang

The `pidrang` CLI (`npx pidrang init`): scaffolds a `Resource` + working CRUD pages from a Supabase table, run from the root of an existing Angular app.

## `pidrang init`

Wires `@pidrang/cli`'s wizard to `@pidrang/cli-supabase`'s Supabase provider (the only registered provider today), then writes into the current directory:

- `src/app/resources.ts` — the generated `Resource[]`
- `src/app/pages/resource-{list,create,show,edit}-page.ts`, `src/app/auth-required-error.ts`, `src/app/record-label.ts` — the generic `@pidrang/material` CRUD pages, copied once (skipped if a file already exists — never overwritten)

It never edits the app's own `app.routes.ts`/`app.config.ts`; it prints the routes snippet and `providePidrang({...})` call to paste in manually, since those files already exist and their exact shape varies per app.

## Packaging

`pidrang`, `@pidrang/cli` and `@pidrang/cli-supabase` are prepared for npm but not published yet (tracked in #25 and #57). `pnpm run verify:artifacts` packs them, installs the tarballs in an empty directory and runs the installed `pidrang` binary, so the published package is tested without workspace links. See `docs/releasing.md`.

## Running unit tests

Run `nx test pidrang-cli` to execute the unit tests via [Vitest](https://vitest.dev/).

## Building

Run `nx build pidrang-cli` to build the app.
