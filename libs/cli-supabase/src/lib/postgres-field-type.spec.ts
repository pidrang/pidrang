import { postgresTypeToFieldType } from './postgres-field-type';

describe('postgresTypeToFieldType', () => {
  it('maps boolean', () => {
    expect(postgresTypeToFieldType('boolean')).toBe('boolean');
  });

  it('maps safe integer/float types to number', () => {
    expect(postgresTypeToFieldType('integer')).toBe('number');
    expect(postgresTypeToFieldType('smallint')).toBe('number');
    expect(postgresTypeToFieldType('real')).toBe('number');
    expect(postgresTypeToFieldType('double precision')).toBe('number');
  });

  it('maps precision-sensitive numeric types to numeric, never number', () => {
    expect(postgresTypeToFieldType('bigint')).toBe('numeric');
    expect(postgresTypeToFieldType('decimal')).toBe('numeric');
    expect(postgresTypeToFieldType('numeric')).toBe('numeric');
  });

  it('maps date to date, timestamps to timestamp, times to time', () => {
    expect(postgresTypeToFieldType('date')).toBe('date');
    expect(postgresTypeToFieldType('timestamp with time zone')).toBe(
      'timestamp',
    );
    expect(postgresTypeToFieldType('timestamp without time zone')).toBe(
      'timestamp',
    );
    expect(postgresTypeToFieldType('time with time zone')).toBe('time');
    expect(postgresTypeToFieldType('time without time zone')).toBe('time');
  });

  it('falls back to text for unknown types', () => {
    expect(postgresTypeToFieldType('text')).toBe('text');
    expect(postgresTypeToFieldType('uuid')).toBe('text');
    expect(postgresTypeToFieldType('jsonb')).toBe('text');
  });
});
