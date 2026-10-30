# CLI reference

`pidrang init` reads your Supabase schema, writes the `Resource` definitions, the resource routes and the generic List, Create, Show and Edit pages, wires the app itself and offers to install the packages it needs. It asks for the project URL first, then how to read your table definitions, then the tables and their actions. `--plan` answers the questions from a JSON file instead. It must be launched from the workspace root of an Angular 22.1+ application created by `ng new` with the router.

## Commands

| Command | What it does |
|---------|-------------|
| `pidrang init [--plan <file>] [--project <name>] [--skip-install]` | Scaffolds Resource definitions and CRUD pages into an Angular app. Run it from the workspace root. |
| `pidrang generate auth [--project <name>]` | Writes the sign-in page the pages and the layout link to, when the app has none. |

Source: `apps/pidrang-cli/src/run-cli.ts`, function `usage`, lines 102–156.

## Options

| Option | Applies to | What it does |
|--------|------------|-------------|
| `--plan <file>` | `init` | Take the answers from a JSON plan file instead of prompts. |
| `--project <name>` | Both | Choose the application to set up when `angular.json` has several. |
| `--skip-install` | `init` | Do not offer to install the packages; print the commands instead. |
| `-h, --help` | Both | Show this help message. |

Source: `apps/pidrang-cli/src/run-cli.ts`, function `usage`, lines 110–114.

## Requirements

| Requirement | How it is checked | What is shown |
|-------------|-------------------|---------------|
| Node.js 22.22.3 or a later 22.x, 24.15.0 or a later 24.x, or 26 and later | `apps/pidrang-cli/src/node-version.ts` reads `process.version` against the range `^22.22.3 || ^24.15.0 || >=26.0.0` | Stops immediately with a plain error before touching any file. |
| Angular 22.1 or a later 22.x | `apps/pidrang-cli/src/preflight-app.ts` reads `@angular/core/package.json` or `package.json` dependencies | Listed among other problems in the "this folder is not an app" message. |

Source: `apps/pidrang-cli/src/node-version.ts` line 1 (`SUPPORTED_NODE`), `apps/pidrang-cli/src/preflight-app.ts` lines 27, 138–166.

## The questions

The wizard asks these questions in order:

| Order | Question | Default | When asked |
|-------|----------|---------|------------|
| 1 | `Which data source do you want to scaffold from?` | — | Only when more than one provider is registered. Source: `libs/cli/src/lib/wizard.ts`, line 271. |
| 2 | `Supabase project URL, from the Connect button at the top of the Supabase dashboard:` | — | Always first for Supabase. Source: `libs/cli-supabase/src/lib/supabase-schema-provider-definition.ts`, line 38. |
| 3 | `How should pidrang read your table definitions?` | `service-role` | Always after the URL. Choices: Secret key (sb_secret_), Direct database connection (host, user, password), GraphQL with the publishable key. Source: same file, line 486. |
| 4 | `Which tables should pidrang scaffold?` | — | After connection is resolved. Multi-select checkbox over available tables. Source: `libs/cli/src/lib/wizard.ts`, line 168. |
| 5 _(per table)_ | `Which actions should "<table>" support?` | All checked | After selecting tables. Checkbox with disabled unavailable actions. Source: `libs/cli/src/lib/wizard.ts` lines 305–312 (`actionsMessage`, label at line 309), checkbox call at lines 321–329. |
| 6 _(per table)_ | `Any fields to hide from the list/edit views for "<table>"? (optional)` | — | Per table. Checkbox listing introspected fields. Source: `libs/cli/src/lib/wizard.ts`, lines 332–338. |
| 7 | `Generate a navigation layout? It adds a header with your app name and a sign in/out link, and a side menu of the resources.` | `true` | New app only; always `"none"` for existing apps. Source: `libs/cli/src/lib/wizard.ts`, lines 21–25. |
| 8 | `Generate a sign-in page at /sign-in? The app needs one to sign in and write data.` | `true` | New app only; always `true` for existing apps. Source: `libs/cli/src/lib/wizard.ts`, lines 29–32. |
| 9 | `Do your tables need a signed-in user to be read? Say yes when the select policy of the tables hides their rows from anonymous visitors, so a new app opens on the sign-in page instead of an empty list.` | `false` | Not asked per-table: graphql and secret-key strategies answer globally; postgres answers per-table. Source: `libs/cli/src/lib/wizard.ts`, lines 36–40. |
| 10 | `Install the required packages?` | `Y` | Always last. Confirms before running the install command. Source: `libs/cli/src/lib/wizard.ts`, line 350. |

When the connection attempt fails, the wizard repeats the question with the rejection message and asks whether to fall back to the secret key (for graphql). Source: `libs/cli-supabase/src/lib/supabase-schema-provider-definition.ts`, lines 148–154.

## What it writes

| File | What lands there | When |
|------|-----------------|------|
| `src/app/resources.ts` | `export const resources: Resource[] = [...]` — one entry per selected table: `{ name, label, fields, defaultSorters?, list, create, show, edit, delete }`. Each field is `{ name, label, type, hidden?, readOnly?, nullable?, hasDefault? }`, inferred from introspection; a field named in the plan file's `hiddenFields` is written with `hidden: true`. `defaultSorters` is written only when a `timestamp` or `date` `created_at` column exists. | Every run. Edited in-place on subsequent runs. |
| `src/app/resource-routes.ts` | Generic routes `:resource`, `:resource/create`, `:resource/:id/edit`, `:resource/:id` pointing to generated pages, with `canMatch` guards. | Every run. Regenerated; an existing guard list is extended in place. |
| `src/app/pages/resource-list-page.ts` | List page using `injectResourceList`, `ResourceTable`, with actions projected. | Every run, on a new or an existing app. A file already there with other content stops `init` before any write. |
| `src/app/pages/resource-create-page.ts` | Create page using `ResourceForm`, calls `dataProvider.create`. | Same as the list page. |
| `src/app/pages/resource-show-page.ts` | Show page displaying fields and links to edit/delete. | Same as the list page. |
| `src/app/pages/resource-edit-page.ts` | Edit page using `ResourceForm`, calls `dataProvider.update`, with a Delete button calling `deleteProvider.delete`. | Same as the list page. |
| `src/app/pidrang/...` | Helpers: `provide-sign-in-path`, `can-match-signed-in`, route utils, etc. | Same as the list page. |
| `src/app/layout/app-layout.ts` | Navigation layout component with header and sidebar menu. | Only when layout is `"sidebar"` on a new app. |
| `src/app/pages/sign-in-page.ts` | Sign-in page component. | New app: when you accept the sign-in question. Existing app in an interactive run: always. Existing app driven by a plan: when the plan sets `signIn: true`. Omitted when `app.routes.ts` already declares the route. `pidrang generate auth` writes it on demand. |
| `app.config.ts` | Adds `providePidrang()`, provides `provideSignInPath()` if configured. | Every run. |
| `app.routes.ts` | Appends the resource routes import, entry redirect for new apps. | Every run. |
| `angular.json` | Adds environment file replacements. | When the app had neither `environment.ts` nor `environment.development.ts`, on a new or an existing app. |
| `src/environments/environment.ts` and `environment.development.ts` | Supabase URL and a placeholder for the publishable key. | Same as `angular.json`. Otherwise `init` prints the lines to add. |

How it wires the app itself is described in [Getting started](../getting-started.md#existing-app). The resource routes guard every `:resource` action with both `canMatchResourceAction(...)` and `canMatchSignedIn([...])` when the corresponding tables need a signed-in user. A file it writes is never overwritten: one that already exists with other content stops `init` before any write. An existing `resources.ts` is edited instead: a second run appends the tables it does not list yet and leaves the others as they are.

Sources: `libs/cli/src/lib/generate-pages-bundle.ts` (`PAGES_UI_LAYER_PACKAGES`, lines 70–73), `libs/cli/src/lib/generated-pages.ts` (page file list), `libs/cli/src/lib/generate-resources-file.ts` (resources.ts generation), `libs/cli/src/lib/build-sign-in-page.ts` (sign-in page generation), `libs/cli/src/lib/generate-layout-module.ts` (layout generation), `apps/pidrang-cli/src/edit-app-config.ts`, `apps/pidrang-cli/src/edit-app-routes.ts`.

## The plan file

```json
{
  "provider": "supabase",
  "connection": { ... },
  "tables": [
    { "table": "products", "actions": ["list", "create", "show", "edit", "delete"], "hiddenFields": ["created_at"] }
  ],
  "layout": "sidebar",
  "signIn": true,
  "readsNeedSignIn": false
}
```

actions lists at least one of list, create, show, edit, delete. hiddenFields is optional. layout is "sidebar" to add a header and a side menu of the resources to a new app, or "none" to leave the pages bare. It defaults to "none" and an existing app never gets one. signIn is true to generate the sign-in page that the pages and the layout link to. It defaults to false and init asks for it on a new app. readsNeedSignIn is true when the select policy of the tables hides their rows from anonymous visitors: a new app then opens on the sign-in page instead of an empty list. It applies to every table, defaults to false, and the direct database connection strategy answers per table from its row level security, its select policies and its grant to the anonymous role instead. Credentials never go in the plan file: they come from environment variables.

### Every key

| Key | Type | Default | Meaning |
|-----|------|---------|--------|
| `provider` | string | — | Provider id, e.g. `"supabase"`. Source: `libs/cli/src/lib/init-plan.ts` line 19. |
| `connection` | object | — | Strategy-dependent connection object (see below). Source: `libs/cli/src/lib/init-plan.ts` line 20. |
| `tables[].table` | string | — | Database table name, used as resource name and URL segment. Source: `libs/cli/src/lib/init-plan.ts` line 3 (TABLE_KEYS). |
| `tables[].actions` | string[] | — | Must list at least one of list, create, show, edit, delete. Duplicates detected. Source: `libs/cli/src/lib/init-plan.ts` lines 95–101. |
| `tables[].hiddenFields` | string[] | `[]` | Fields omitted from list and edit views. Source: `libs/cli/src/lib/init-plan.ts` lines 102–106. |
| `layout` | `"sidebar"` \| `"none"` | `"none"` | `"sidebar"` for new apps only; existing apps ignore it and keep theirs. Source: `libs/cli/src/lib/init-plan.ts` lines 22, 170. |
| `signIn` | boolean | `false` | Generate the sign-in page. Defaults to false; init asks on new apps. Source: `libs/cli/src/lib/init-plan.ts` lines 23, 171. |
| `readsNeedSignIn` | boolean | `false` | Global per-table override when the postgres strategy answers per-table. Source: `libs/cli/src/lib/init-plan.ts` lines 24, 172. |

### Connection per strategy

```
Supabase plan connection, one of:
  { "strategy": "graphql", "url": "https://<ref>.supabase.co" }
      publishable key from PIDRANG_SUPABASE_PUBLISHABLE_KEY
  { "strategy": "secret-key", "url": "https://<ref>.supabase.co" }
      secret key from PIDRANG_SUPABASE_SECRET_KEY
  { "strategy": "postgres", "host": "db.<ref>.supabase.co", "port": 5432,
    "database": "postgres", "user": "postgres", "tls": true,
    "caCertificatePath": "prod-ca.crt", "url": "https://<ref>.supabase.co" }
      password from PIDRANG_DATABASE_PASSWORD; port, database, user, tls,
      caCertificatePath and url are optional, tls defaults to on for a remote
      host, a relative caCertificatePath is read from the current folder, not
      from the folder of the plan file, and url fills supabaseUrl in the app
      when the host does not name the project
```

Keys allowed per strategy (strict): `graphql` allows `strategy` and `url`; `secret-key` allows the same; `postgres` allows `strategy`, `host`, `port`, `database`, `user`, `tls`, `caCertificatePath`, and `url`. Extra keys produce validation errors (secrets must not appear in the plan, use env vars).

Source: `libs/cli-supabase/src/lib/supabase-schema-provider-definition.ts` lines 259–275 (`PLAN_HELP`).

Legacy names still work and print a warning: `"service-role"` for `"secret-key"`, `PIDRANG_SUPABASE_ANON_KEY` for `PIDRANG_SUPABASE_PUBLISHABLE_KEY`, `PIDRANG_SUPABASE_SERVICE_ROLE_KEY` for `PIDRANG_SUPABASE_SECRET_KEY`. Source: same file, lines 141–142, 227–229.

### Secrets from the environment

| Variable | Used by | Legacy name |
|----------|---------|-------------|
| `PIDRANG_SUPABASE_PUBLISHABLE_KEY` | `graphql` connection | `PIDRANG_SUPABASE_ANON_KEY` |
| `PIDRANG_SUPABASE_SECRET_KEY` | `secret-key` connection | `PIDRANG_SUPABASE_SERVICE_ROLE_KEY` |
| `PIDRANG_DATABASE_PASSWORD` | `postgres` connection | — |

When both the new variable and the legacy name are set, the new variable wins. The legacy name produces a deprecation warning printed to stderr.

Source: `libs/cli-supabase/src/lib/supabase-schema-provider-definition.ts` lines 225–237 (`ENV_*` constants, `SECRETS_IN_ENV`).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Done or nothing to do. Covers: successful write, everything already up to date, install skipped/installed, present, unsupported manager. |
| 1 | Invalid input, unsupported Node.js or app, conflicting file, failed install, unknown provider, wrong table name. |
| 130 | Cancelled by the user (interrupt signal or declining install). Prints `Cancelled: nothing was written.` to stderr. |

Source: `apps/pidrang-cli/src/run-cli.ts` lines 69–71 (`EXIT_OK`, `EXIT_FAILED`, `EXIT_CANCELLED`) and the `INSTALL_STATUS` map at line 566.

## A second run

`resources.ts` is edited: tables not yet listed are appended, tables already listed are left as they are. A file with different content stops `init` before any write, listing the conflicted paths. The layout of a first-run app is preserved: a second run on an existing app never sets the layout to `"sidebar"`. When a file cannot be edited safely, `init` adds a `// pidrang:` comment that lists the exact change to make.

Guard updates: a guard already written receives new private tables appended to its list. Guards for tables not seen in `resources.ts` are held back until those tables are listed.

Source: `apps/pidrang-cli/src/run-cli.ts` lines 772–810 (resources edit, guarded resources).

## A new app and an existing app

On a new app, `init` replaces the welcome page, generates the full page bundle (list, create, show, edit), creates the layout module with a sidebar, writes the sign-in page (when requested), and configures `app.html` to host the layout. On an existing app it adds the resource routes to `app.routes.ts` and edits `resources.ts` and `app.config.ts`, writes the same pages and helpers as on a new app, and the sign-in page (always in an interactive run, or when the plan sets `signIn: true`). A page already there with other content stops `init` before any write. It adds no layout and no entry redirect: when `app.routes.ts` has no `''` route, it prints the redirect to add.

The layout feature (`app-layout.ts`) is gated on four conditions met together: the app must be new (`ng new`'s `app.html` has not been changed), `app.html` must contain only `<app-layout>`, `app.ts` must match the `ng new` template, and the layout must be requested (`sidebar`). When any condition fails, `init` reports the missing files and skips the layout. An existing app kept its own `app.html` and never receives a layout.

Source: `apps/pidrang-cli/src/run-cli.ts` lines 676–697 (layout conditions), `libs/cli/src/lib/generate-layout-module.ts` lines 14–17 (`LAYOUTS` map keyed on `LayoutUi`).

## When the tables need a signed-in user

Tables marked with `readsNeedSignIn: true` receive a `canMatchSignedIn([...])` guard on all their actions. The guard redirects an anonymous visitor to the sign-in path when `provideSignInPath` configured one; without it, the navigation goes through. The generated pages show a "You may need to sign in" prompt only after a write is refused for lack of sign-in: a delete on the list page, a create on the create page, an update on the edit page. The show page never shows it. With `provideSignInPath` the words "sign in" are a link; without it they stay plain text.

For new apps: init asks once ("Do your tables need a signed-in user to be read?") and applies the answer globally. The new app opens on the sign-in page when `readsNeedSignIn` is true. For existing apps: a new run appends private tables already listed in `resources.ts` to the existing guard. Tables not yet listed are held back with an error message referencing where to add them manually.

Only the `postgres` strategy answers `readsNeedSignIn` per-table (reading the actual Row Level Security policies). The `graphql` and `secret-key` strategies ask a single global question.

Source: `libs/cli/src/lib/wizard.ts` lines 43–55 (`providerReadsNeedSignIn`), `apps/pidrang-cli/src/run-cli.ts` lines 652–665 (guard setup and unguarded resources message).

## The sign-in page

`init` writes the sign-in page at `src/app/pages/sign-in-page.ts` in three cases: on a new app when you accept the sign-in question, on an existing app in an interactive run where it is always written and the question is not asked, and on an existing app driven by a plan whose `signIn` is `true`. The page links to the login method provided by the app.

`pidrang generate auth` writes the same page when `app.routes.ts` has no existing sign-in route and `app.config.ts` does not call `provideSignInPath` with another path.

`init` writes its own `sign-in` route into `resource-routes.ts`, above the `:resource` routes. When `app.routes.ts` already declares a first segment named `sign-in`, it writes no sign-in route and leaves yours in place. A table whose name is already a route declared in `app.routes.ts` is refused, so the `:resource` routes cannot take the sign-in path. Source: `libs/cli/src/lib/generate-pages-bundle.ts` lines 5-11 and 97-110 (sign-in route placement), `apps/pidrang-cli/src/preflight-app.ts` lines 180-182 (`declaresSignInRoute`), `libs/cli/src/lib/wizard.ts` lines 77-86 (`routeNameProblem`).

Source: `apps/pidrang-cli/src/run-cli.ts` lines 435–443 (instruction printed without provider), `libs/demo-shared/src/lib/provide-sign-in-path.ts` (validation logic).

## Changing what it wrote

- Generated files are ordinary application files. You can edit them freely.
- `init` refuses to overwrite a generated file whose content differs from what it expects, and lists it instead.
- To regenerate the generic pages (list, create, show, edit), delete `src/app/pages` and `src/app/pidrang` together, then run `init` again. Individual page regeneration is not supported.
- The helpers under `src/app/pidrang/` are called by the generated pages and the layout module, so deleting them breaks the build even when `resources.ts` is correct.
- `pnpm run sync:pages` and `sync:layout` serve the demo repositories in this codebase; they are not meant for consumer applications.

Source: `apps/pidrang-cli/src/run-cli.ts` lines 143–146 (never-overwrite rule, manual comments), `apps/pidrang-cli/src/write-plan.ts` (conflict detection), `docs/design-notes.md` lines 157, 169.

## When it stops

| Condition | Written | What to do |
|-----------|---------|------------|
| No `angular.json` or not valid JSON | Error message listing problems | Run from the workspace root of an Angular app. |
| Missing `app.config.ts` or `app.routes.ts` | Error message | These must be present in a standalone app set up like `ng new` creates it. |
| Unsupported Node.js | Plain error with required range, "Nothing was written." | Install a supported Node.js version. |
| Unsupported Angular version | Listed in the "not an app" message | Upgrade or downgrade `@angular/core` to 22.1+. |
| Table named as a reserved route | Throws with table JSON + reason | Rename the table. Reserved: `resource-unavailable`. Collision with existing routes also rejected. |
| Invalid response (no action selected, empty table name, control character) | Throws with description | Fix the selection and try again. |
| Conflict: file exists with other content | Lists conflicted files under `resources.ts`, stops before any write | Resolve the conflict (the older pages need `src/app/pages` and `src/app/pidrang` deleted together). |
| Install failed | Printed command, remaining commands listed | Run the printed command manually or fix the package manager issue. |

Sources: `apps/pidrang-cli/src/preflight-app.ts` lines 189–226 (preflight checks), `apps/pidrang-cli/src/node-version.ts` line 39 (node check), `apps/pidrang-cli/src/run-cli.ts` lines 615–617, 893–903 (conflict reporting), `apps/pidrang-cli/src/install-packages.ts` lines 142–156 (missing packages detection).
