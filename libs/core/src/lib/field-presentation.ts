import { Field, FieldType } from './field';

const INPUT_TYPE_BY_FIELD_TYPE: Record<
  Exclude<FieldType, 'boolean'>,
  string
> = {
  text: 'text',
  number: 'number',
  numeric: 'text',
  date: 'date',
  timestamp: 'text',
  time: 'text',
};

const FORMAT_PATTERN_BY_FIELD_TYPE: Partial<Record<FieldType, RegExp>> = {
  timestamp:
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
  time: /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
  numeric: /^-?\d+(\.\d+)?$/,
};

const FORMAT_HINT_BY_FIELD_TYPE: Partial<Record<FieldType, string>> = {
  timestamp: 'Enter a timestamp like 2024-01-01T10:30:00 or with a Z suffix.',
  time: 'Enter a time like 10:30 or 10:30:00.',
  numeric: 'Enter a whole or decimal number, such as 42 or 19.99.',
};

const DEFAULT_FORMAT_HINT = 'This value is not valid.';

const FIELD_TYPES_WHERE_EMPTY_MEANS_NO_VALUE = new Set<FieldType>([
  'timestamp',
  'time',
  'numeric',
  'date',
]);

const TEXT_INPUT_BOUND_FIELD_TYPES = new Set<FieldType>([
  'timestamp',
  'time',
  'numeric',
]);

export function inputTypeForField(field: Field): string {
  return INPUT_TYPE_BY_FIELD_TYPE[field.type as Exclude<FieldType, 'boolean'>];
}

export function formatPatternForField(field: Field): RegExp | undefined {
  return FORMAT_PATTERN_BY_FIELD_TYPE[field.type];
}

export function formatHintForField(field: Field): string {
  return FORMAT_HINT_BY_FIELD_TYPE[field.type] ?? DEFAULT_FORMAT_HINT;
}

export function fieldRequiresValueWhenEmpty(field: Field): boolean {
  return (
    FIELD_TYPES_WHERE_EMPTY_MEANS_NO_VALUE.has(field.type) && !field.nullable
  );
}

export function isTextInputBoundField(field: Field): boolean {
  return TEXT_INPUT_BOUND_FIELD_TYPES.has(field.type);
}
