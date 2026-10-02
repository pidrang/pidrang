# @pidrang/material

Angular Material UI layer for `@pidrang/core`. Schema-driven components that render from a `Resource`'s `Field[]` instead of hand-written markup per resource.

## Installation

```bash
npm install @pidrang/material @pidrang/core @angular/material
```

## Documentation

See the [getting started guide](https://github.com/pidrang/pidrang/blob/main/docs/getting-started.md) and the [main repository](https://github.com/pidrang/pidrang).

## Exports

- `ResourceTable<T>` — renders `fields: Field[]` / `data: T[]` as a `MatTable`. Project an `#actions` template to add a trailing actions column:
  ```html
  <lib-resource-table [fields]="fields()" [data]="data()">
    <ng-template #actions let-row>
      <a mat-button [routerLink]="['/', resource, row.id]">Show</a>
    </ng-template>
  </lib-resource-table>
  ```
- `ResourceForm<T>` — renders `fields: Field[]` into one `mat-form-field`/`mat-checkbox` per field (based on `FieldType`), pre-filled from a `value: T` input. A required `mode: 'create' | 'edit'` input selects the save payload: on create every field is sent except an untouched one with `hasDefault`; on edit only a touched field is sent, so an untouched value is never re-serialized. A `pending` input disables the submit button (showing "Saving…", `aria-busy` on the form) and ignores submits while a save is in flight. Built on Signal Forms (`@angular/forms/signals`); never mutates the `value` input.

## Dependencies

Depends only on `@pidrang/core` and `@angular/material` (`peerDependencies`) — no `DataProvider`-specific code, works with any `@pidrang/core` app. Angular Material has no `@angular/animations` dependency, so none is required here either.

## Running unit tests

Run `nx test material` to execute the unit tests.

## Building

Run `nx build material` to build the publishable package.
