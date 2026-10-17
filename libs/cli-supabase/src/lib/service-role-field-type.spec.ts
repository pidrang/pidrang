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

  describe.each([
    [
      'PostgREST 14',
      {
        smallint: { type: 'integer', format: 'smallint' },
        integer: { type: 'integer', format: 'integer' },
        bigint: { type: 'integer', format: 'bigint' },
      },
    ],
    [
      'PostgREST 16',
      {
        smallint: { type: 'integer', format: 'int32' },
        integer: { type: 'integer', format: 'int32' },
        bigint: { type: 'integer', format: 'int64' },
      },
    ],
  ])('with the column formats of %s', (_, integers) => {
    it.each([
      ['smallint', integers.smallint, 'number'],
      ['integer, serial, identity and generated', integers.integer, 'number'],
      ['bigint and bigserial', integers.bigint, 'numeric'],
      ['real', { type: 'number', format: 'real' }, 'number'],
      [
        'double precision',
        { type: 'number', format: 'double precision' },
        'number',
      ],
      ['numeric', { type: 'number', format: 'numeric' }, 'numeric'],
      ['boolean', { type: 'boolean', format: 'boolean' }, 'boolean'],
      ['text', { type: 'string', format: 'text' }, 'text'],
      ['varchar', { type: 'string', format: 'character varying' }, 'text'],
      ['char', { type: 'string', format: 'character' }, 'text'],
      ['uuid', { type: 'string', format: 'uuid' }, 'text'],
      ['date', { type: 'string', format: 'date' }, 'date'],
      ['time', { type: 'string', format: 'time without time zone' }, 'time'],
      ['timetz', { type: 'string', format: 'time with time zone' }, 'time'],
      [
        'timestamp',
        { type: 'string', format: 'timestamp without time zone' },
        'timestamp',
      ],
      [
        'timestamptz',
        { type: 'string', format: 'timestamp with time zone' },
        'timestamp',
      ],
    ])('maps %s', (_, property, type) => {
      expect(openApiPropertyToFieldType(property)).toBe(type);
    });

    it.each([
      ['json', { format: 'json' }, 'json'],
      ['jsonb', { format: 'jsonb' }, 'jsonb'],
      [
        'integer[]',
        { type: 'array', format: 'integer[]', items: { type: 'integer' } },
        'integer[]',
      ],
      [
        'an enum',
        { type: 'string', format: 'public.mood', enum: ['a', 'b'] },
        'enum public.mood',
      ],
      ['bytea', { type: 'string', format: 'bytea' }, 'bytea'],
      ['interval', { type: 'string', format: 'interval' }, 'interval'],
    ])('leaves out %s', (_, property, shownAs) => {
      expect(openApiPropertyToFieldType(property)).toEqual({
        unsupported: shownAs,
      });
    });
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
