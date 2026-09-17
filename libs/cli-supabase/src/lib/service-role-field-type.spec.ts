import { openApiPropertyToFieldType } from './service-role-field-type';

describe('openApiPropertyToFieldType', () => {
  it('maps boolean', () => {
    expect(openApiPropertyToFieldType('boolean', 'bool')).toBe('boolean');
  });

  it('maps integer/number types to number', () => {
    expect(openApiPropertyToFieldType('integer', 'int4')).toBe('number');
    expect(openApiPropertyToFieldType('number', 'numeric')).toBe('number');
  });

  it('maps date/timestamp formats to date', () => {
    expect(openApiPropertyToFieldType('string', 'date')).toBe('date');
    expect(openApiPropertyToFieldType('string', 'timestamptz')).toBe('date');
  });

  it('falls back to text for unknown formats', () => {
    expect(openApiPropertyToFieldType('string', 'text')).toBe('text');
    expect(openApiPropertyToFieldType('string', 'uuid')).toBe('text');
    expect(openApiPropertyToFieldType('string', undefined)).toBe('text');
  });
});
