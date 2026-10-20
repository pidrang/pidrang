<p align="center">
  <a href="https://pidrang.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-light.png">
      <img src="./.github/assets/logo-dark.png" alt="Pidrang: Build Angular admin applications faster." width="480">
    </picture>
  </a>
</p>

<br>

<div align="center">

[![CI](https://github.com/pidrang/pidrang/actions/workflows/ci.yml/badge.svg)](https://github.com/pidrang/pidrang/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@pidrang/core?label=%40pidrang%2Fcore)](https://www.npmjs.com/package/@pidrang/core)
[![License: MIT](https://img.shields.io/github/license/pidrang/pidrang)](./LICENSE)

</div>

<br>

Pidrang is an open-source, headless framework designed to eliminate boilerplate code when building Angular administration panels, dashboards, and internal tools. Inspired by the architecture of Refine, it brings data providers, authentication management, and state tracking to the Angular ecosystem.

Website: [pidrang.dev](https://pidrang.dev)

Pidrang is pre-1.0: the public API may change between minor versions.

## Features

- **Headless architecture:** decoupled from the UI. Use Angular Material or Tailwind today, or build your own layer on the same contracts.
- **Signal-first:** built on Angular Signals and the native `resource()` API for fine-grained reactivity.
- **Data providers:** first-class Supabase support, with a small `DataProvider` contract for any other backend.
- **Auth provider:** sign-in, sign-out and a signal-based session, with the same pluggable design.
- **Schema-driven UI:** `ResourceTable` and `ResourceForm` render from a `Resource` definition instead of hand-written markup per table.
- **CLI:** `npx pidrang init` introspects a Supabase schema and scaffolds `Resource` definitions and Angular Material CRUD pages into an existing Angular app.

## Packages

| Package                                | Description                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| [`@pidrang/core`](./libs/core)         | Contracts, `providePidrang` and signal-based state. Depends on `@angular/core` only.   |
| [`@pidrang/supabase`](./libs/supabase) | `DataProvider` and `AuthProvider` backed by Supabase.                                  |
| [`@pidrang/material`](./libs/material) | `ResourceTable` and `ResourceForm` on Angular Material and Signal Forms.               |
| [`@pidrang/tailwind`](./libs/tailwind) | The same components styled with Tailwind utility classes.                              |
| [`pidrang`](./apps/pidrang-cli)        | The CLI: `npx pidrang init` scaffolds resources and CRUD pages from a Supabase schema. |

## Install

In an Angular 22.1+ standalone app:

```bash
npm install @pidrang/core @pidrang/supabase @pidrang/material @supabase/supabase-js
ng add @angular/material
npx pidrang init
```

`pidrang init` generates the resources and pages, then wires them into the app: it edits `app.config.ts`, `app.routes.ts` and `app.html`, and creates the environment files (with their `angular.json` file replacement) when the app has none. Step by step: [Getting started](./docs/getting-started.md).

## Quick look

```ts
import { providePidrang } from '@pidrang/core';
import { provideSupabaseDataProvider } from '@pidrang/supabase';
import { createClient } from '@supabase/supabase-js';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const appConfig = {
  providers: [
    providePidrang({
      dataProvider: provideSupabaseDataProvider({ client }),
      resources: [
        {
          name: 'products',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'price', type: 'number' },
          ],
        },
      ],
    }),
  ],
};
```

```html
<pidrang-material-resource-table [fields]="fields()" [data]="list.value()?.data ?? []" />
```

The full walkthrough, from a new Angular app to a working list, create and edit flow, is in [`docs/getting-started.md`](./docs/getting-started.md).

## Documentation

- [Getting started](./docs/getting-started.md)
- [Architecture](./docs/architecture.md)
- [Design notes](./docs/design-notes.md)
- [Writing a data provider](./docs/data-providers.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](./CHANGELOG.md)

## Demos

`apps/demo-material` and `apps/demo-tailwind` show the same three resources (`users`, `products`, `orders`) with two different UI layers, both backed by the public `pidrang` Supabase project. Everything they share (Supabase wiring, resources, routes, helpers) lives once in the internal, unpublished `libs/demo-shared`; each demo keeps only its own pages and theme.

## Development

```bash
pnpm install
pnpm exec nx run-many -t lint test build
pnpm exec nx serve demo-material
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the branching and commit conventions.

## Security

Pidrang performs no authorization of its own: access control comes from the Row Level Security policies on your Supabase project. To report a vulnerability, see [`SECURITY.md`](./SECURITY.md).

## License

MIT, see [`LICENSE`](./LICENSE).
