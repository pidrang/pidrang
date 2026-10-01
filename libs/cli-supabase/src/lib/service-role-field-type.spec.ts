import { openApiPropertyToFieldType } from './service-role-field-type';

describe('openApiPropertyToFieldType', () => {
  it('maps boolean', () => {
    expect(openApiPropertyToFieldType('boolean', 'bool')).toBe('boolean');
  });

  it('maps safe integer/float formats to number', () => {
    expect(openApiPropertyToFieldType('integer', 'int4')).toBe('number');
    expect(openApiPropertyToFieldType('integer', 'smallint')).toBe('number');
    expect(openApiPropertyToFieldType('number', 'float8')).toBe('number');
  });

  it('maps precision-sensitive numeric formats to numeric, never number', () => {
    expect(openApiPropertyToFieldType('integer', 'int8')).toBe('numeric');
    expect(openApiPropertyToFieldType('integer', 'bigint')).toBe('numeric');
    expect(openApiPropertyToFieldType('number', 'numeric')).toBe('numeric');
    expect(openApiPropertyToFieldType('number', 'decimal')).toBe('numeric');
  });

  it('maps date format to date, timestamp formats to timestamp, time formats to time', () => {
    expect(openApiPropertyToFieldType('string', 'date')).toBe('date');
    expect(openApiPropertyToFieldType('string', 'timestamptz')).toBe(
      'timestamp',
    );
    expect(openApiPropertyToFieldType('string', 'timestamp')).toBe('timestamp');
    expect(openApiPropertyToFieldType('string', 'timetz')).toBe('time');
    expect(openApiPropertyToFieldType('string', 'time')).toBe('time');
  });

  it('falls back to text for unknown formats', () => {
    expect(openApiPropertyToFieldType('string', 'text')).toBe('text');
    expect(openApiPropertyToFieldType('string', 'uuid')).toBe('text');
    expect(openApiPropertyToFieldType('string', undefined)).toBe('text');
  });
});
