# Pidrang

> Build Angular admin applications faster.

Pidrang is an open-source, headless framework designed to eliminate boilerplate code when building Angular administration panels, dashboards, and internal tools. Inspired by the architecture of Refine, it brings data providers, authentication management, and state tracking to the Angular ecosystem.

---

## 🚀 Features (Roadmap)

- 🔌 **Headless Architecture:** Decoupled from the UI. Use Angular Material, PrimeNG, Tailwind, or custom styles.
- ⚡ **Signal-First:** Built from the ground up leveraging Angular Signals for fine-grained reactivity.
- 🗄️ **Data Providers:** First-class support for Supabase (REST, GraphQL, and custom backends coming soon).
- 🔐 **Auth Provider:** Simplified authentication flow integration.
- 🎨 **Material UI Layer:** Schema-driven `ResourceTable`/`ResourceForm` built on Angular Material and Signal Forms.
- 📦 **Monorepo Structure:** Clean modular architecture (`@pidrang/core`, `@pidrang/supabase`, `@pidrang/material`).

---

## 🛠️ Project Structure

```text
pidrang/
├── apps/
│   └── demo/           # Angular test application
└── libs/
    ├── core/           # Headless primitives & contracts (@pidrang/core)
    ├── supabase/       # Supabase DataProvider implementation (@pidrang/supabase)
    └── material/       # Angular Material UI layer (@pidrang/material)
```

## Quick start

```
pnpm install
pnpm exec nx test core
pnpm exec nx build core
```

To run `apps/demo` against a local Supabase instance instead of the hosted project:

```
# in a clone of pidrang/supabase
supabase start

# in this repo
pnpm exec nx serve demo --configuration=local
```

## Architecture

`@pidrang/core` is framework-native (Angular) but UI-agnostic: it depends on `@angular/core` only, never on a component library. Everything else builds on top of it:

- `Resource` (optionally described with `Field`/`FieldType` for a typed form/table), `DataProvider`, `ListParams`/`ListResult<T>`, `GetOneParams`/`CreateParams<T>`/`UpdateParams<T>`/`DeleteParams`
- `providePidrang({ dataProvider, resources })` for app-wide configuration
- `injectDataProvider()`, `injectResources()`, `injectResource(name)` for reading that configuration
- `injectResourceList<T>(resourceName, params?)`, a signal-based list loader built on Angular's native `resource()`

`@pidrang/supabase` implements `DataProvider` against `@supabase/supabase-js` (`SupabaseDataProvider`, `provideSupabaseDataProvider({ client })`). UI packages (`@pidrang/material`, later `primeng`/`tailwind`) will consume core's reactive primitives without knowing which `DataProvider` is wired in.

`AuthProvider` (`login`, `logout`, `getIdentity`) follows the same pattern as `DataProvider`: `providePidrang({ authProvider, ... })` registers it, `injectAuthProvider()` reads it, and `injectAuthSession()` wraps it in a signal-based `resource()` for the current identity (`value()` is `AuthIdentity | null | undefined` while loading/signed-out/signed-in). `@pidrang/supabase` implements it with `SupabaseAuthProvider` / `provideSupabaseAuthProvider({ client })`, backed by Supabase Auth.

`SupabaseDataProvider` and `SupabaseAuthProvider` perform no authorization themselves — every access guarantee comes from the Row Level Security policies on the integrator's own Supabase project. Pidrang assumes those policies are correctly configured; it does not enforce or verify them.

`@pidrang/material` is the first UI layer: schema-driven components (`ResourceTable`, `ResourceForm`) that render from a `Resource`'s `Field[]` instead of hand-written markup per resource. It depends only on `@pidrang/core` and `@angular/material` — never on a specific `DataProvider` — so it works with `@pidrang/supabase` today and any future `DataProvider` without changes. `ResourceTable` supports a projected `#actions` template (`contentChild` + `ngTemplateOutlet`) for per-row buttons/links rendered as a real trailing column. `ResourceForm` is built on Angular's Signal Forms (`@angular/forms/signals`), with a `linkedSignal` draft that resets whenever its `value` input changes without mutating the caller's original object.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for current progress.

## Contributing

...

## License

MIT
