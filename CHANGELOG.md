## 0.1.0 (2026-10-19)

### Features

- scaffold @pidrang/core and @pidrang/supabase libraries ([ec7e4ec](https://github.com/pidrang/pidrang/commit/ec7e4ec))
- **cli:** scaffold @pidrang/cli, @pidrang/cli-supabase and pidrang-cli projects ([b91fa21](https://github.com/pidrang/pidrang/commit/b91fa21))
- **cli:** add SchemaProvider contract to @pidrang/cli ([05bead3](https://github.com/pidrang/pidrang/commit/05bead3))
- **cli:** add init wizard to @pidrang/cli ([809e00f](https://github.com/pidrang/pidrang/commit/809e00f))
- **cli:** generate Resource config from the wizard plan ([67503bb](https://github.com/pidrang/pidrang/commit/67503bb))
- **cli:** generate the generic Material CRUD pages bundle ([b669c9f](https://github.com/pidrang/pidrang/commit/b669c9f))
- **cli-supabase:** implement SchemaProvider for Supabase with 3 connection strategies ([87e5e4b](https://github.com/pidrang/pidrang/commit/87e5e4b))
- **core:** implement Resource and DataProvider contracts ([185b7da](https://github.com/pidrang/pidrang/commit/185b7da))
- **core:** add optional field schema to Resource ([723910a](https://github.com/pidrang/pidrang/commit/723910a))
- **core:** add Field.hidden, respected by demo-material's generic list/edit pages ([8830133](https://github.com/pidrang/pidrang/commit/8830133))
- **core:** validate list pagination params ([ea7cae2](https://github.com/pidrang/pidrang/commit/ea7cae2))
- **core:** add isResourceActionEnabled predicate ([88703b4](https://github.com/pidrang/pidrang/commit/88703b4))
- **core:** add auth session change subscription and PidrangError ([4be8cd3](https://github.com/pidrang/pidrang/commit/4be8cd3))
- **core:** add typed list filters with validation and legacy record support ([4261f1b](https://github.com/pidrang/pidrang/commit/4261f1b))
- **core,supabase:** add auth provider contract and Supabase implementation ([22e9bbf](https://github.com/pidrang/pidrang/commit/22e9bbf))
- **demo:** wire core + supabase in apps/demo with generic CRUD pages ([9148f78](https://github.com/pidrang/pidrang/commit/9148f78))
- **demo:** improve some UI ([560e1a2](https://github.com/pidrang/pidrang/commit/560e1a2))
- **material:** add ResourceTable, first @pidrang/material component ([8b14d8e](https://github.com/pidrang/pidrang/commit/8b14d8e))
- **material:** add ResourceForm, typed Create/Edit form component ([b1b6e80](https://github.com/pidrang/pidrang/commit/b1b6e80))
- **material:** add pending input to ResourceForm ([730f979](https://github.com/pidrang/pidrang/commit/730f979))
- **pidrang-cli:** add the  bin entrypoint ([32da414](https://github.com/pidrang/pidrang/commit/32da414))
- **supabase:** implement SupabaseDataProvider ([56b6df3](https://github.com/pidrang/pidrang/commit/56b6df3))
- **supabase:** map typed filters to PostgREST and return an empty page past the last row ([34fb39a](https://github.com/pidrang/pidrang/commit/34fb39a))
- **tailwind:** add ResourceTable, first @pidrang/tailwind component ([40e39cb](https://github.com/pidrang/pidrang/commit/40e39cb))
- **tailwind:** add ResourceForm, typed Create/Edit form component ([f5120fa](https://github.com/pidrang/pidrang/commit/f5120fa))
- **tailwind:** add pending input to ResourceForm ([5387981](https://github.com/pidrang/pidrang/commit/5387981))

### Fixes

- unusual comments ([d42a263](https://github.com/pidrang/pidrang/commit/d42a263))
- type filters per operator and reject shapes and field names providers cannot honor ([20e6309](https://github.com/pidrang/pidrang/commit/20e6309))
- ⚠️  give each UI adapter its own selectors and an Actions column header ([#53](https://github.com/pidrang/pidrang/issues/53))
- **auth:** keep the session value while reloading, never throw from value(), skip same-user SIGNED_IN ([d3657a2](https://github.com/pidrang/pidrang/commit/d3657a2))
- **cli:** enforce resource action flags in generated pages ([4fc7466](https://github.com/pidrang/pidrang/commit/4fc7466))
- **cli:** generate the race-safe pages and pin them to demo-material ([0f70603](https://github.com/pidrang/pidrang/commit/0f70603))
- **cli:** generate the confirmed, failure-aware list page ([2b15903](https://github.com/pidrang/pidrang/commit/2b15903))
- **cli:** import the generated helpers by file and return a fresh bundle per call ([e3e321d](https://github.com/pidrang/pidrang/commit/e3e321d))
- **cli:** link the generated sign-in prompt only to a path the app provides ([7243846](https://github.com/pidrang/pidrang/commit/7243846))
- **cli:** check the app and every file before init writes anything ([#54](https://github.com/pidrang/pidrang/issues/54))
- **cli:** print the full route setup and refuse broken links ([d6af5bb](https://github.com/pidrang/pidrang/commit/d6af5bb))
- **cli-supabase:** fix graphql strategy's introspection query and verify all 3 strategies live ([a20819c](https://github.com/pidrang/pidrang/commit/a20819c))
- **cli-supabase:** throw on non-2xx in the graphql introspection ([5687071](https://github.com/pidrang/pidrang/commit/5687071))
- **cli-supabase:** reject unsupported schema generation ([0e5503f](https://github.com/pidrang/pidrang/commit/0e5503f))
- **cli-supabase:** require a primary key named id and a reachable TLS path ([d8ae2b2](https://github.com/pidrang/pidrang/commit/d8ae2b2))
- **cli-supabase:** reject schema shapes pidrang cannot generate ([#52](https://github.com/pidrang/pidrang/issues/52))
- **cli-supabase:** read the integer formats of PostgREST 16 ([84e37b5](https://github.com/pidrang/pidrang/commit/84e37b5))
- **core:** reject non-object filter entries and treat null filters as none ([7d9c1c6](https://github.com/pidrang/pidrang/commit/7d9c1c6))
- **core:** send an untouched boolean on create only, ignore readOnly in submit checks ([cba68c3](https://github.com/pidrang/pidrang/commit/cba68c3))
- **core:** send an untouched number without a default on create as shown ([1edf5d8](https://github.com/pidrang/pidrang/commit/1edf5d8))
- **demo:** base auth hints on error categories and show session errors ([988c051](https://github.com/pidrang/pidrang/commit/988c051))
- **demo:** scope the in-flight delete to the current resource ([7f35962](https://github.com/pidrang/pidrang/commit/7f35962))
- **demo:** ignore stale delete failures and lock pagination while deleting ([b5380ce](https://github.com/pidrang/pidrang/commit/b5380ce))
- **demo:** refresh the list through a params revision so no delete refresh is dropped ([2b38817](https://github.com/pidrang/pidrang/commit/2b38817))
- **demo:** scope the create/edit saving state to the current route ([51422d4](https://github.com/pidrang/pidrang/commit/51422d4))
- **demo:** lock each record's save across visits and report its outcome ([9747004](https://github.com/pidrang/pidrang/commit/9747004))
- **demo:** keep only running saves, time out silent requests and hide outcomes across sessions ([4eab988](https://github.com/pidrang/pidrang/commit/4eab988))
- **demo:** keep a running delete locked across visits and report how it ended ([7e8594b](https://github.com/pidrang/pidrang/commit/7e8594b))
- **forms:** preserve defaults and lossless scalar values ([#51](https://github.com/pidrang/pidrang/issues/51))
- **forms:** block save only on touched invalid fields, finish CLI serialization) ([bddd41b](https://github.com/pidrang/pidrang/commit/bddd41b))
- **forms:** address review feedback on defaults and lossless scalars ([435ab3d](https://github.com/pidrang/pidrang/commit/435ab3d))
- **forms:** stop required() blocking defaulted fields, fix service-role flags, normalize text-bound values ([532b0ca](https://github.com/pidrang/pidrang/commit/532b0ca))
- **forms:** omit an untouched field on create too, not just hasDefault ones ([5106fc7](https://github.com/pidrang/pidrang/commit/5106fc7))
- **forms:** always send an untouched boolean without a server default ([6478f63](https://github.com/pidrang/pidrang/commit/6478f63))
- **lists:** paginate demo and generated list pages by stable id order ([3955875](https://github.com/pidrang/pidrang/commit/3955875))
- **material:** tighten ResourceForm typing and use idiomatic Signal Forms submit ([74f0d14](https://github.com/pidrang/pidrang/commit/74f0d14))
- **routes:** let unknown resources fall through and redirect disabled actions to resource-unavailable ([258d1fc](https://github.com/pidrang/pidrang/commit/258d1fc))
- **supabase:** share toError() between data and auth providers ([8ae16a9](https://github.com/pidrang/pidrang/commit/8ae16a9))
- **supabase:** reject malformed pagination before querying ([b9acb13](https://github.com/pidrang/pidrang/commit/b9acb13))
- **supabase:** order getList by id as a default tie-breaker ([81304af](https://github.com/pidrang/pidrang/commit/81304af))
- **supabase:** propagate auth failures and categorize provider errors ([56fcac4](https://github.com/pidrang/pidrang/commit/56fcac4))
- **supabase:** match contains literally with imatch and escape in-list values ([381aa17](https://github.com/pidrang/pidrang/commit/381aa17))
- **tailwind:** track table rows by id ([645d896](https://github.com/pidrang/pidrang/commit/645d896))

### Refactors

- **demo:** share the demos' helpers, config and routes through libs/demo-shared ([57880be](https://github.com/pidrang/pidrang/commit/57880be))
- **demo:** move the CRUD page logic into shared page state functions ([ee9bb3a](https://github.com/pidrang/pidrang/commit/ee9bb3a))

### ⚠️  Breaking Changes

- give each UI adapter its own selectors and an Actions column header  ([#53](https://github.com/pidrang/pidrang/issues/53))
  use pidrang-material-resource-form/table and
  pidrang-tailwind-resource-form/table instead of lib-resource-form/table.
  Closes #53

# Changelog

All notable changes to the published packages are documented in this file. Entries are generated from Conventional Commits when a release is cut, see [`docs/releasing.md`](./docs/releasing.md). The packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html); while the version is below 1.0.0, minor releases may contain breaking changes.
