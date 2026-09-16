# apps/demo — CLAUDE.md

Package-specific rules for `apps/demo`. The org-wide conventions in the root `CLAUDE.md` apply here too; this file only covers what's specific to this app.

## Generic pages, not per-table components

`pages/` has exactly one component per CRUD verb (`resource-list-page`, `resource-create-page`, `resource-show-page`, `resource-edit-page`) plus `home-page` and `sign-in-page` — there is no `users-list-page` or `products-list-page`. Every page reads the active resource from the `:resource` route param (see `app.routes.ts`) and drives itself from `@pidrang/core`'s `injectResourceList`/`injectDataProvider`/`injectResource`. Adding a new admin table means adding an entry to the `resources` array in `app.config.ts` plus the matching Supabase table — never a new page component.

## Route order is load-bearing

`app.routes.ts` matches routes top to bottom: `create` and `:id/edit` must stay listed before the generic `:id` and `:resource` routes, and `login` must stay listed before `:resource` (see the comment in that file). Adding a new static route (not a `:resource/...` variant) means placing it above the generic resource routes, not just appending it at the end.

## `environment.ts` vs `environment.local.ts`

`environment.ts` holds the real `pidrang` Supabase project's URL and a public anon key (safe to commit — it's a publishable key, access is governed entirely by RLS on that project, not by keeping it secret). `environment.local.ts` holds the fixed Supabase CLI local-dev keys, identical for every contributor running `supabase start` against the `pidrang/supabase` repo's unmodified `config.toml`, and is swapped in via `fileReplacements` on the `local` build configuration (`nx serve demo --configuration=local`). Don't blank out or hand-edit `environment.ts` to test a "no config" scenario — read the guard in `app.config.ts` (or whatever superseded it) to see how that case is meant to be exercised instead.

## Page components use inline templates

Every page component under `pages/` sets `template` (and inline styles where needed) directly in the `@Component` decorator rather than `templateUrl`/`styleUrl` — the app shell (`app.ts`/`app.html`/`app.css`) is the only place using separate files, since it's the one component with router-outlet-level markup worth keeping out of the TS file. Follow whichever pattern the file you're editing already uses; don't split a page component's template into a separate `.html` file without a reason to deviate from the rest of `pages/`.
