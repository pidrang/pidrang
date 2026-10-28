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

Declare both stylesheets under `"styles"` in the `build` options of the project in `angular.json` (or in its `project.json`), the application stylesheet first and the theme second:

```json
"styles": [
  "src/styles.css",
  "src/theme.scss"
]
```

Source: `apps/demo-material/project.json` lines 23–26.

## Selector

Every component emits elements prefixed with `pidrang-material-`:

- `<pidrang-material-resource-table>`
- `<pidrang-material-resource-form>`

## See it running

https://pidrang.dev/demo-material/
