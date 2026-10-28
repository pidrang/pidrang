# UI layers

A UI layer is a package of components that depend on `@pidrang/core` and their own styling library, never on a `DataProvider`. Pidrang ships two today — Material and Tailwind — and plans a third.

## Material and Tailwind

| Package | Styling | What you install | What the app must configure |
|---------|---------|-----------------|----------------------------|
| `@pidrang/material` | Angular Material | `@pidrang/material` + `@angular/material` (via `ng add @angular/material`) | A `mat.theme()` call with palette, typography and density; `color-scheme: light dark` in the root element |
| `@pidrang/tailwind` | Tailwind utility classes | `@pidrang/tailwind` only (app must already have Tailwind v4) | A `@source` line pointing at the installed library so its template classes are scanned and generated |

See [Angular Material](./material.md) or [Tailwind CSS](./tailwind.md) for the setup of each one.

## The same API

| Class | Material element | Tailwind element |
|-------|-----------------|------------------|
| `ResourceTable<T>` | `pidrang-material-resource-table` | `pidrang-tailwind-resource-table` |
| `ResourceForm<T>` | `pidrang-material-resource-form` | `pidrang-tailwind-resource-form` |

Switching between layers is a change of import and element name. See [Components reference](../reference/components.md) for inputs, outputs and behaviour.

## What the generator writes

Three facts about what `pidrang init` generates:

1. **Layout and sign-in follow the app's declared UI layer** — `layoutUiOf()` checks `package.json`; if the app declares `@pidrang/tailwind`, the layout and sign-in page use Tailwind styles, otherwise they use Material. Source: `apps/pidrang-cli/src/app-tooling.ts` lines 93–101.
2. **Generated CRUD pages are always Angular Material** — `PAGES_UI_LAYER_PACKAGES` always installs `@pidrang/material` and `@angular/material`, and uses the Material selectors. An app using `@pidrang/tailwind` still needs Material installed for its generated pages. Source: `libs/cli/src/lib/generate-pages-bundle.ts` lines 70–73.
3. Pages can be replaced — see [the CLI reference](../reference/cli.md#changing-what-it-wrote).

## Choosing

- Use Material if your application already uses Angular Material.
- Use Tailwind if your application has Tailwind v4 and no component library.
- Both can coexist in one app — they use distinct selectors (`pidrang-material-*` vs `pidrang-tailwind-*`).

## A third layer

A third layer, `@pidrang/ng-zorro`, is planned and implements the same contract.
