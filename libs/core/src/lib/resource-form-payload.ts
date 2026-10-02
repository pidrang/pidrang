import { Field } from './field';
import { isTextInputBoundField } from './field-presentation';

export type ResourceFormMode = 'create' | 'edit';

function valueForField(field: Field, value: unknown): unknown {
  if (value === '' && field.nullable && isTextInputBoundField(field)) {
    return null;
  }
  return value;
}

export function buildResourcePayload<T extends Record<string, unknown>>(
  mode: ResourceFormMode,
  fields: Field[],
  draft: T,
  isDirty: (name: string) => boolean,
): Record<string, unknown> {
  const entries = fields
    .filter((field) =>
      mode === 'create'
        ? !field.hasDefault || isDirty(field.name)
        : isDirty(field.name),
    )
    .map(
      (field) => [field.name, valueForField(field, draft[field.name])] as const,
    );
  return Object.fromEntries(entries);
}

export function shouldBlockSubmit(
  mode: ResourceFormMode,
  dirty: boolean,
  invalid: boolean,
): boolean {
  return mode === 'create' ? invalid : dirty && invalid;
}
