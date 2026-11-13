# @pidrang/material

Angular Material UI layer for `@pidrang/core`. Schema-driven components that render from a `Resource`'s `Field[]` instead of hand-written markup per resource.

## Installation

```bash
npm install @pidrang/material @pidrang/core @angular/material
```

## Documentation

See the [getting started guide](https://github.com/pidrang/pidrang/blob/main/docs/getting-started.md) and the [main repository](https://github.com/pidrang/pidrang).

## Exports

- `ResourceTable<T>` — renders `fields: Field[]` / `data: T[]` as a `MatTable`. The element is `<pidrang-material-resource-table>`. Project an `#actions` template to add a trailing column with an `Actions` header; a data field named `actions` still gets its own column:
  ```html
  <pidrang-material-resource-table
    [fields]="fields()"
    [data]="data()"
    [sort]="sort()"
    (sortChange)="sort.set($event)"
  >
    <ng-template #actions let-row>
      <a mat-button [routerLink]="['/', resource, row.id]">Show</a>
    </ng-template>
  </pidrang-material-resource-table>
  ```
  Bind `[sort]` (a `Sorter` or `null`) and `(sortChange)` to sort by clicking a column header: ascending, descending, then `null` for the default order; a field with `sortable: false` gets no sort header. Bind both: the table shows the `sort` it receives, but without `[sort]` MatSort still moves its own arrow on a click.

  Long values are shown on one line, cut at 12rem with an ellipsis, with the full value in the cell's `title`; cells align to the top and the actions column stays on one line.
- `ResourceForm<T>` (`<pidrang-material-resource-form>`) — renders `fields: Field[]` into one `mat-form-field`/`mat-checkbox` per non-`readOnly` field (based on `FieldType`), pre-filled from a `value: T` input. A required `mode: 'create' | 'edit'` input selects submit behavior: on both, only a touched field is sent, so an untouched value is never re-serialized and the server's own default/`NULL` applies to anything left alone, except that on create an untouched `boolean` or `number` without `hasDefault` is sent as shown (an unchecked box means `false`, a `0` means `0`); on edit, `save` does not emit at all if nothing was actually changed (PostgREST rejects an empty `PATCH`), while create still emits an empty payload since "create a row from nothing but defaults" is legitimate. `save` emits `Partial<T>`, reflecting that a payload is genuinely partial. A `pending` input disables the submit button (showing "Saving…", `aria-busy` on the form) and ignores submits while a save is in flight. Built on Signal Forms (`@angular/forms/signals`); never mutates the `value` input.

## Dependencies

Depends only on `@pidrang/core` and `@angular/material` (`peerDependencies`) — no `DataProvider`-specific code, works with any `@pidrang/core` app. Angular Material has no `@angular/animations` dependency, so none is required here either.

## Running unit tests

Run `nx test material` to execute the unit tests.

## Building

Run `nx build material` to build the publishable package.
