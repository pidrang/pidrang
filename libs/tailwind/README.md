# @pidrang/tailwind

Tailwind CSS UI layer for `@pidrang/core`. Schema-driven components that render from a `Resource`'s `Field[]` instead of hand-written markup per resource, styled with Tailwind utility classes instead of a component library.

## Installation

```bash
npm install @pidrang/tailwind @pidrang/core tailwindcss
```

## Documentation

See the [getting started guide](https://github.com/pidrang/pidrang/blob/main/docs/getting-started.md) and the [main repository](https://github.com/pidrang/pidrang).

## Exports

- `ResourceTable<T>` — renders `fields: Field[]` / `data: T[]` as a plain `<table>`. Project an `#actions` template to add a trailing actions column:
  ```html
  <lib-resource-table [fields]="fields()" [data]="data()">
    <ng-template #actions let-row>
      <a class="text-blue-600 hover:underline" [routerLink]="['/', resource, row.id]">Show</a>
    </ng-template>
  </lib-resource-table>
  ```
- `ResourceForm<T>` — renders `fields: Field[]` into one labeled `<input>`/checkbox per non-`readOnly` field (based on `FieldType`), pre-filled from a `value: T` input. A required `mode: 'create' | 'edit'` input selects the save payload: on create every field is sent except an untouched one with `hasDefault`; on edit only a touched field is sent, so an untouched value is never re-serialized, and `save` does not emit at all if nothing was actually changed. `save` emits `Partial<T>`, reflecting that an edit payload is genuinely partial. A `pending` input disables the submit button (showing "Saving…", `aria-busy` on the form) and ignores submits while a save is in flight. Built on Signal Forms (`@angular/forms/signals`); never mutates the `value` input.

## Dependencies

Depends only on `@pidrang/core`, `@angular/forms` (Signal Forms), and Tailwind CSS classes as plain strings (`peerDependencies`) — no `DataProvider`-specific code, works with any `@pidrang/core` app. Ships no CSS itself: the consuming app's own Tailwind build is what turns the utility classes used here into real styles, so its `content` glob must include this library's sources (or the built `dist/libs/tailwind` output) or the classes get purged.

## Running unit tests

Run `nx test tailwind` to execute the unit tests.

## Building

Run `nx build tailwind` to build the publishable package.
