# Tailwind CSS

## Installation

```bash
npm install @pidrang/tailwind
```

The consuming application must already have Tailwind CSS v4 installed. Pidrang does not install or configure Tailwind itself.

## The @source line

Add a `@source` line after the Tailwind import in your global stylesheet:

```css
@import 'tailwindcss';
@source '../../../libs/tailwind/src';
```

Adjust the relative path so it points at `node_modules/@pidrang/tailwind` from where your stylesheet sits. This tells Tailwind to scan the library's templates and emit the utility classes it uses. Without this line the classes get purged during the build because the library ships no CSS of its own.

Source: `apps/demo-tailwind/src/styles.css` lines 1–2.

## Selector

Every component emits elements prefixed with `pidrang-tailwind-`:

- `<pidrang-tailwind-resource-table>`
- `<pidrang-tailwind-resource-form>`

## Material is still needed

Generated CRUD pages (List, Create, Show, Edit) are always rendered with Angular Material, even in a Tailwind app. You must install `@pidrang/material` and `@angular/material` and configure a theme when using Tailwind. See [What the generator writes](./index.md#what-the-generator-writes).

## See it running

https://pidrang.dev/demo-tailwind/
