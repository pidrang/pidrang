# @pidrang/demo-shared

Internal library shared by `apps/demo-material` and `apps/demo-tailwind`. It is private and never published.

It holds what both demos had in identical copies: the Supabase wiring (`demoAppConfig`), the demo resources (`DEMO_RESOURCES`), the route table (`demoRoutes`), the action-flag route guard (`canMatchResourceAction`, `RESOURCE_UNAVAILABLE_PATH`) and small helpers (`recordLabel`, `isAuthRequiredError`, `isSupabaseConfigured`, `DEMO_ACCOUNT`). Each demo keeps only its pages and its theme.

`pidrang init` copies the helpers its generated pages need into the consumer app under `src/app/pidrang/`, with imports rewritten to relative paths, so a generated app never depends on this library. After changing one of those files, run `pnpm run sync:pages` (see `docs/design-notes.md`).

## Running unit tests

Run `nx test demo-shared` to execute the unit tests.
