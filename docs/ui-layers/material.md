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

## Page styles

`mat.theme()` only declares the `--mat-sys-*` variables, which Material components read. It does not style the page and does not load Roboto. Without the two additions below, headings and plain text use the browser's default font and colors.

Load Roboto in `src/index.html`, in `<head>`:

```html
    <link rel="preconnect" href="https://fonts.gstatic.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap"
      rel="stylesheet"
    />
```

Apply the variables in the application stylesheet, `src/styles.css`:

```css
body {
  margin: 0;
  font: var(--mat-sys-body-medium);
  color: var(--mat-sys-on-surface);
  background: var(--mat-sys-surface);
}

h1 {
  font: var(--mat-sys-headline-small);
}

h2 {
  font: var(--mat-sys-title-large);
}

a {
  color: var(--mat-sys-primary);
}

[role='alert'] {
  color: var(--mat-sys-error);
}
```

Source: apps/demo-material/src/index.html and apps/demo-material/src/styles.css.

## Selector

Every component emits elements prefixed with `pidrang-material-`:

- `<pidrang-material-resource-table>`
- `<pidrang-material-resource-form>`

## See it running

https://pidrang.dev/demo-material/
