# Pidrang

> Build Angular admin applications faster.

Pidrang is an open-source, headless framework designed to eliminate boilerplate code when building Angular administration panels, dashboards, and internal tools. Inspired by the architecture of Refine, it brings data providers, authentication management, and state tracking to the Angular ecosystem.

---

## 🚀 Features (Roadmap)

- 🔌 **Headless Architecture:** Decoupled from the UI. Use Angular Material, PrimeNG, Tailwind, or custom styles.
- ⚡ **Signal-First:** Built from the ground up leveraging Angular Signals for fine-grained reactivity.
- 🗄️ **Data Providers:** First-class support for Supabase (REST, GraphQL, and custom backends coming soon).
- 🔐 **Auth Provider:** Simplified authentication flow integration.
- 📦 **Monorepo Structure:** Clean modular architecture (`@pidrang/core`, `@pidrang/supabase`).

---

## 🛠️ Project Structure

```text
pidrang/
├── apps/
│   └── demo/           # Angular test application
└── libs/
    ├── core/           # Headless primitives & contracts (@pidrang/core)
    └── supabase/       # Supabase DataProvider implementation (@pidrang/supabase)
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

- `Resource`, `DataProvider`, `ListParams`/`ListResult<T>`, `GetOneParams`/`CreateParams<T>`/`UpdateParams<T>`/`DeleteParams`
- `providePidrang({ dataProvider, resources })` for app-wide configuration
- `injectDataProvider()`, `injectResources()`, `injectResource(name)` for reading that configuration
- `injectResourceList<T>(resourceName, params?)`, a signal-based list loader built on Angular's native `resource()`

`@pidrang/supabase` implements `DataProvider` against `@supabase/supabase-js` (`SupabaseDataProvider`, `provideSupabaseDataProvider({ client })`). UI packages (`@pidrang/material`, later `primeng`/`tailwind`) will consume core's reactive primitives without knowing which `DataProvider` is wired in.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for current progress.

## Contributing

...

## License

MIT
