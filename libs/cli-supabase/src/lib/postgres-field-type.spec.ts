import { postgresTypeToFieldType } from './postgres-field-type';

describe('postgresTypeToFieldType', () => {
  it('maps boolean', () => {
    expect(postgresTypeToFieldType('boolean')).toBe('boolean');
  });

  it('maps integer/numeric types to number', () => {
    expect(postgresTypeToFieldType('integer')).toBe('number');
    expect(postgresTypeToFieldType('bigint')).toBe('number');
    expect(postgresTypeToFieldType('numeric')).toBe('number');
  });

  it('maps date/timestamp types to date', () => {
    expect(postgresTypeToFieldType('date')).toBe('date');
    expect(postgresTypeToFieldType('timestamp with time zone')).toBe('date');
  });

  it('falls back to text for unknown types', () => {
    expect(postgresTypeToFieldType('text')).toBe('text');
    expect(postgresTypeToFieldType('uuid')).toBe('text');
    expect(postgresTypeToFieldType('jsonb')).toBe('text');
  });
});
