import { Field, FieldType } from './field';
import { isTextInputBoundField } from './field-presentation';

export type ResourceFormMode = 'create' | 'edit';

function valueForField(field: Field, value: unknown): unknown {
  if (value === '' && field.nullable && isTextInputBoundField(field)) {
    return null;
  }
  return value;
}

const FIELD_TYPES_SHOWN_AS_A_VALUE = new Set<FieldType>(['boolean', 'number']);

function isShownValueSentOnCreate(
  mode: ResourceFormMode,
  field: Field,
): boolean {
  return (
    mode === 'create' &&
    FIELD_TYPES_SHOWN_AS_A_VALUE.has(field.type) &&
    !field.hasDefault
  );
}

function shouldIncludeField(
  mode: ResourceFormMode,
  field: Field,
  isDirty: (name: string) => boolean,
): boolean {
  return isDirty(field.name) || isShownValueSentOnCreate(mode, field);
}

export function buildResourcePayload<T extends Record<string, unknown>>(
  mode: ResourceFormMode,
  fields: Field[],
  draft: T,
  isDirty: (name: string) => boolean,
): Record<string, unknown> {
  const entries = fields
    .filter(
      (field) => !field.readOnly && shouldIncludeField(mode, field, isDirty),
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

function normalizedValue(field: Field, value: unknown): unknown {
  if (!isTextInputBoundField(field) || typeof value === 'string') {
    return value;
  }
  return value === null || value === undefined ? '' : String(value);
}

export function normalizeResourceValue<T extends Record<string, unknown>>(
  fields: Field[],
  value: T,
): T {
  const entries = Object.entries(value).map(([name, v]) => {
    const field = fields.find((candidate) => candidate.name === name);
    return [name, field ? normalizedValue(field, v) : v] as const;
  });
  return Object.fromEntries(entries) as T;
}
