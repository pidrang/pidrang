# @pidrang/material

Angular Material UI layer for `@pidrang/core`. Schema-driven components that render from a `Resource`'s `Field[]` instead of hand-written markup per resource.

## Exports

- `ResourceTable<T>` — renders `fields: Field[]` / `data: T[]` as a `MatTable`. Project an `#actions` template to add a trailing actions column:
  ```html
  <lib-resource-table [fields]="fields()" [data]="data()">
    <ng-template #actions let-row>
      <a mat-button [routerLink]="['/', resource, row.id]">Show</a>
    </ng-template>
  </lib-resource-table>
  ```
- `ResourceForm<T>` — renders `fields: Field[]` into one `mat-form-field`/`mat-checkbox` per field (based on `FieldType`), pre-filled from a `value: T` input, emits the edited value via `(save)` on submit. Built on Signal Forms (`@angular/forms/signals`); never mutates the `value` input.

## Dependencies

Depends only on `@pidrang/core` and `@angular/material` (`peerDependencies`) — no `DataProvider`-specific code, works with any `@pidrang/core` app. Angular Material has no `@angular/animations` dependency, so none is required here either.

## Running unit tests

Run `nx test material` to execute the unit tests.

## Building

Run `nx build material` to build the publishable package.
