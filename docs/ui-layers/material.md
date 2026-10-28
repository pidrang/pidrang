# Angular Material

## Installation

```bash
npm install @pidrang/material
ng add @angular/material
```

## Theming

Import Material and declare a theme in a SCSS stylesheet loaded by the app:

```scss
@use '@angular/material' as mat;

html {
  color-scheme: light dark;
  @include mat.theme(
    (
      color: mat.$violet-palette,
      typography: Roboto,
      density: 0,
    )
  );
}

[color='warn'] {
  @include mat.theme(
    (
      color: mat.$red-palette,
    )
  );
}
```

This sets violet as the primary palette, Roboto as typography, and zero density (no spacing compression). The `[color='warn']` scope overrides the warn palette to red because M3's single-mixin API does not wire the legacy `.mat-warn` class mapping on its own.

## Where the stylesheet goes

Add the stylesheet path under `"styles"` in `angular.json` or in the `files` field of `app.config.ts`:

```json
"styles": ["src/styles.scss"]
```

Source: `apps/demo-material/project.json` `"styles"` field.

## Selector

Every component emits elements prefixed with `pidrang-material-`:

- `<pidrang-material-resource-table>`
- `<pidrang-material-resource-form>`

## See it running

https://pidrang.dev/demo-material/
