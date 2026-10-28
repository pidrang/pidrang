# Components reference

Switching between layers is a change of import and element name. Each layer's setup is in [Angular Material](../ui-layers/material.md) and [Tailwind CSS](../ui-layers/tailwind.md).

## The four components

| Package | Class | Element |
|---------|-------|---------|
| `@pidrang/material` | `ResourceTable<T>` | `pidrang-material-resource-table` |
| | `ResourceForm<T>` | `pidrang-material-resource-form` |
| `@pidrang/tailwind` | `ResourceTable<T>` | `pidrang-tailwind-resource-table` |
| | `ResourceForm<T>` | `pidrang-tailwind-resource-form` |

## ResourceTable

Inputs:

| Input | Type | Required | What it does |
|-------|------|----------|-------------|
| `fields` | `Field[]` | Yes | Columns to display — one data column per non-hidden field, in order. Source: `libs/material/src/lib/resource-table/resource-table.ts` line 19 (Material); Tailwind equivalent at `libs/tailwind/src/lib/resource-table/resource-table.ts`. |
| `data` | `T[]` | Yes | Rows to render. Source: same file, line 20. |

Projected `#actions`: a `TemplateRef<{ $implicit: T }>` rendered as the last column with an `Actions` header. The `$implicit` context variable gives access to the current row object. A data column named `actions` keeps its own column alongside the projected one — column names are internal identifiers (`field-0`, `field-1`, …) so no collision is possible. Source: `libs/material/src/lib/resource-table/resource-table.ts` line 21; `docs/design-notes.md` line 89.

Mat table columns use positional names (`field-N`) rather than field names for identification, avoiding the duplicate-column error that would occur if a data column were named `actions` (colliding with the projected actions column).

## ResourceForm

Inputs and outputs:

| Input / Output | Type | Required | What it does |
|----------------|------|----------|-------------|
| `mode` | `'create' \| 'edit'` | Yes | Form mode — determines validation rules and what `save` emits. Source: `libs/material/src/lib/resource-form/resource-form.ts` line 57. |
| `fields` | `Field[]` | Yes | Fields to render — one input per editable (non-`readOnly`) field. Source: same file, line 58. |
| `value` | `T` | Yes | Draft values bound through a linkedSignal never mutating the caller's input. Source: same file, line 59. |
| `pending` | `boolean` | No (default `false`) | While true the form disables submit and ignores further submissions. Source: same file, line 60. |
| `(save)` | `` `output<Partial<T>>()` `` | — | Emits when the user submits — only fields actually changed, filtered through `buildResourcePayload`. Source: same file, line 61. |

Behaviour:

| Behaviour | When |
|-----------|------|
| Only changed fields are sent in `save`. Unchanged fields are dropped from the payload so the server's own default or `NULL` applies instead of a client placeholder. | Always. Source: `libs/core/src/lib/resource-form-payload.ts` lines 34–48 (`buildResourcePayload`). |
| On create, a `boolean` or `number` without `hasDefault` sends the value shown (unchecked checkbox = `false`, empty number input = `0`). | Create mode only. Source: same file, lines 15–23 (`isShownValueSentOnCreate`). |
| On edit, `save` emits nothing when nothing changed. | Edit mode with no dirty fields. Source: `resource-form.ts` lines 142–144. |
| `readOnly` fields are neither rendered nor sent. | Always. Source: same file, line 77 (`editableFields`). |
| Validation by type with format patterns for `date`, `timestamp`, `time`, `numeric`. An empty input on those types blocks submit unless `nullable: true`. | Always. Source: `libs/core/src/lib/field-presentation.ts` lines 18–25 (pattern), lines 36–41 (empty means no value), `resource-form.ts` lines 90–96 (`isRequiredWhenEmpty`). |
| Submit blocked while invalid. In create mode, blocking starts immediately; in edit mode only after the field is touched and dirty + invalid. | Depends on `shouldBlockSubmit(mode, dirty, invalid)`. Source: `libs/core/src/lib/resource-form-payload.ts` lines 50–56. |

`ResourceForm` is remounted per resource and per record (via `@for (r of [key]; track r)` keyed on resource name or `` `${resource()}:${id()}` ``) so Signal Forms do not carry stale dirty state across navigations. Source: `docs/design-notes.md` line 95.

## Choosing a layer

[UI layers](../ui-layers/index.md) compares Material and Tailwind and says what the generator writes for each one.
