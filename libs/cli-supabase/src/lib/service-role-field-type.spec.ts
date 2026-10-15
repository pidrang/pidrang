import { openApiPropertyToFieldType } from './service-role-field-type';

describe('openApiPropertyToFieldType', () => {
  it('maps boolean', () => {
    expect(
      openApiPropertyToFieldType({ type: 'boolean', format: 'bool' }),
    ).toBe('boolean');
    expect(
      openApiPropertyToFieldType({ type: 'boolean', format: 'boolean' }),
    ).toBe('boolean');
  });

  it('maps safe integer/float formats to number', () => {
    expect(
      openApiPropertyToFieldType({ type: 'integer', format: 'int4' }),
    ).toBe('number');
    expect(
      openApiPropertyToFieldType({ type: 'integer', format: 'integer' }),
    ).toBe('number');
    expect(
      openApiPropertyToFieldType({ type: 'integer', format: 'smallint' }),
    ).toBe('number');
    expect(
      openApiPropertyToFieldType({ type: 'number', format: 'float8' }),
    ).toBe('number');
  });

  it('maps precision-sensitive numeric formats to numeric, never number', () => {
    expect(
      openApiPropertyToFieldType({ type: 'integer', format: 'int8' }),
    ).toBe('numeric');
    expect(
      openApiPropertyToFieldType({ type: 'integer', format: 'bigint' }),
    ).toBe('numeric');
    expect(
      openApiPropertyToFieldType({ type: 'number', format: 'numeric' }),
    ).toBe('numeric');
    expect(
      openApiPropertyToFieldType({ type: 'number', format: 'decimal' }),
    ).toBe('numeric');
  });

  it('maps date format to date, timestamp formats to timestamp, time formats to time', () => {
    expect(openApiPropertyToFieldType({ type: 'string', format: 'date' })).toBe(
      'date',
    );
    expect(
      openApiPropertyToFieldType({ type: 'string', format: 'timestamptz' }),
    ).toBe('timestamp');
    expect(
      openApiPropertyToFieldType({
        type: 'string',
        format: 'timestamp with time zone',
      }),
    ).toBe('timestamp');
    expect(
      openApiPropertyToFieldType({ type: 'string', format: 'timetz' }),
    ).toBe('time');
    expect(
      openApiPropertyToFieldType({
        type: 'string',
        format: 'time without time zone',
      }),
    ).toBe('time');
  });

  it('maps text-like formats to text', () => {
    expect(openApiPropertyToFieldType({ type: 'string', format: 'text' })).toBe(
      'text',
    );
    expect(
      openApiPropertyToFieldType({
        type: 'string',
        format: 'character varying',
      }),
    ).toBe('text');
    expect(openApiPropertyToFieldType({ type: 'string', format: 'uuid' })).toBe(
      'text',
    );
  });

  it.each([
    ['jsonb', { format: 'jsonb' }, 'jsonb'],
    ['json', { format: 'json' }, 'json'],
    [
      'an array',
      { type: 'array', format: 'text[]', items: { type: 'string' } },
      'text[]',
    ],
    [
      'an enum',
      { type: 'string', format: 'public.order_status', enum: ['a', 'b'] },
      'enum public.order_status',
    ],
    ['bytea', { type: 'string', format: 'bytea' }, 'bytea'],
    ['an unknown integer format', { type: 'integer', format: 'oid' }, 'oid'],
    ['a property with no format', { type: 'string' }, 'string'],
  ])('reports %s as unsupported', (_, property, shownAs) => {
    expect(openApiPropertyToFieldType(property)).toEqual({
      unsupported: shownAs,
    });
  });
});
