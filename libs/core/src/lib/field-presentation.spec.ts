import { Field } from './field';
import {
  fieldRequiresValueWhenEmpty,
  formatHintForField,
  formatPatternForField,
  inputTypeForField,
} from './field-presentation';

function field(overrides: Partial<Field>): Field {
  return { name: 'value', type: 'text', ...overrides };
}

describe('inputTypeForField', () => {
  it('binds timestamp, time and numeric to a plain text input', () => {
    expect(inputTypeForField(field({ type: 'timestamp' }))).toBe('text');
    expect(inputTypeForField(field({ type: 'time' }))).toBe('text');
    expect(inputTypeForField(field({ type: 'numeric' }))).toBe('text');
  });

  it('keeps number and date on their native input types', () => {
    expect(inputTypeForField(field({ type: 'number' }))).toBe('number');
    expect(inputTypeForField(field({ type: 'date' }))).toBe('date');
  });
});

describe('formatPatternForField', () => {
  it('has no pattern for a plain text or boolean field', () => {
    expect(formatPatternForField(field({ type: 'text' }))).toBeUndefined();
  });

  it('matches a zoned timestamp and rejects a bare one', () => {
    const pattern = formatPatternForField(field({ type: 'timestamp' }));
    expect(pattern?.test('2024-01-01T10:30:00+02:00')).toBe(true);
    expect(pattern?.test('2024-01-01T10:30:00')).toBe(true);
    expect(pattern?.test('not-a-timestamp')).toBe(false);
  });

  it('matches a whole or decimal number', () => {
    const pattern = formatPatternForField(field({ type: 'numeric' }));
    expect(pattern?.test('42')).toBe(true);
    expect(pattern?.test('19.99')).toBe(true);
    expect(pattern?.test('abc')).toBe(false);
  });
});

describe('formatHintForField', () => {
  it('gives a type-specific hint for a formatted type', () => {
    expect(formatHintForField(field({ type: 'numeric' }))).toContain('number');
  });

  it('falls back to a generic hint for a type without one', () => {
    expect(formatHintForField(field({ type: 'text' }))).toBe(
      'This value is not valid.',
    );
  });
});

describe('fieldRequiresValueWhenEmpty', () => {
  it('requires a value for a non-nullable timestamp, time, numeric or date field', () => {
    expect(fieldRequiresValueWhenEmpty(field({ type: 'timestamp' }))).toBe(
      true,
    );
    expect(fieldRequiresValueWhenEmpty(field({ type: 'time' }))).toBe(true);
    expect(fieldRequiresValueWhenEmpty(field({ type: 'numeric' }))).toBe(true);
    expect(fieldRequiresValueWhenEmpty(field({ type: 'date' }))).toBe(true);
  });

  it('does not require a value when the field is nullable', () => {
    expect(
      fieldRequiresValueWhenEmpty(field({ type: 'timestamp', nullable: true })),
    ).toBe(false);
  });

  it('does not require a value for a plain text, number or boolean field', () => {
    expect(fieldRequiresValueWhenEmpty(field({ type: 'text' }))).toBe(false);
    expect(fieldRequiresValueWhenEmpty(field({ type: 'number' }))).toBe(false);
    expect(fieldRequiresValueWhenEmpty(field({ type: 'boolean' }))).toBe(false);
  });
});
