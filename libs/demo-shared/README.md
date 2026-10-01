# @pidrang/demo-shared

Internal library shared by `apps/demo-material` and `apps/demo-tailwind`. It is private and never published.

It holds what both demos had in identical copies: the logic of the List, Create, Edit and Show pages (`injectResourceListState`, `injectResourceCreateState`, `injectResourceEditState`, `injectResourceShowState`, built on `injectResourceDefinition` and `injectResourceRecord`), the Supabase wiring (`demoAppConfig`), the demo resources (`DEMO_RESOURCES`), the route table (`demoRoutes`), the action-flag route guard (`canMatchResourceAction`, `RESOURCE_UNAVAILABLE_PATH`) and small helpers (`recordLabel`, `isAuthRequiredError`, `isSupabaseConfigured`, `DEMO_ACCOUNT`) and the sign-in link: `SIGN_IN_PATH`, which `demoAppConfig` sets to `/login` through `SIGN_IN_ROUTE`, `provideSignInPath`, which resolves the path from the app root and refuses a malformed or outside one before the app starts, and `injectSignInUrl()`, which pages call to read it. The create and edit states share a per-record save lock, `injectSaveLock`, backed by a root store (`save-store.ts`, left out of this library's index; the barrel `pidrang init` generates does export it, since that code belongs to the app) that holds only the saves still running, so it outlives the page; a request that does not answer within 30 seconds fails with `SaveTimeoutError`. `injectEarlierSave` and `SaveOutcome` report the result of a save started on an earlier visit, and `navigationFailure` is the message for a save whose next page did not open. Each demo page keeps only its template, its inputs and its UI adapters (Material paginator events, Tailwind select), so a behavior fix is made once and both demos, plus the pages `pidrang init` generates, get it.

`pidrang init` copies the helpers its generated pages need into the consumer app under `src/app/pidrang/`, with imports rewritten to relative paths, so a generated app never depends on this library. After changing one of those files, run `pnpm run sync:pages` (see `docs/design-notes.md`).

## Running unit tests

Run `nx test demo-shared` to execute the unit tests.
