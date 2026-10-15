import { postgresTypeToFieldType } from './postgres-field-type';

describe('postgresTypeToFieldType', () => {
  it('maps boolean', () => {
    expect(postgresTypeToFieldType('boolean', 'bool')).toBe('boolean');
  });

  it('maps safe integer/float types to number', () => {
    expect(postgresTypeToFieldType('integer', 'int4')).toBe('number');
    expect(postgresTypeToFieldType('smallint', 'int2')).toBe('number');
    expect(postgresTypeToFieldType('real', 'float4')).toBe('number');
    expect(postgresTypeToFieldType('double precision', 'float8')).toBe(
      'number',
    );
  });

  it('maps precision-sensitive numeric types to numeric, never number', () => {
    expect(postgresTypeToFieldType('bigint', 'int8')).toBe('numeric');
    expect(postgresTypeToFieldType('decimal', 'numeric')).toBe('numeric');
    expect(postgresTypeToFieldType('numeric', 'numeric')).toBe('numeric');
  });

  it('maps date to date, timestamps to timestamp, times to time', () => {
    expect(postgresTypeToFieldType('date', 'date')).toBe('date');
    expect(
      postgresTypeToFieldType('timestamp with time zone', 'timestamptz'),
    ).toBe('timestamp');
    expect(
      postgresTypeToFieldType('timestamp without time zone', 'timestamp'),
    ).toBe('timestamp');
    expect(postgresTypeToFieldType('time with time zone', 'timetz')).toBe(
      'time',
    );
    expect(postgresTypeToFieldType('time without time zone', 'time')).toBe(
      'time',
    );
  });

  it('maps text-like types to text', () => {
    expect(postgresTypeToFieldType('text', 'text')).toBe('text');
    expect(postgresTypeToFieldType('character varying', 'varchar')).toBe(
      'text',
    );
    expect(postgresTypeToFieldType('character', 'bpchar')).toBe('text');
    expect(postgresTypeToFieldType('uuid', 'uuid')).toBe('text');
  });

  it.each([
    ['json', 'json', 'json'],
    ['jsonb', 'jsonb', 'jsonb'],
    ['ARRAY', '_text', 'text[]'],
    ['ARRAY', '_int4', 'int4[]'],
    ['USER-DEFINED', 'order_status', 'order_status'],
    ['USER-DEFINED', 'citext', 'citext'],
    ['bytea', 'bytea', 'bytea'],
    ['interval', 'interval', 'interval'],
    ['inet', 'inet', 'inet'],
    ['tsvector', 'tsvector', 'tsvector'],
  ])(
    'reports %s (%s) as unsupported, named %s',
    (dataType, udtName, shownAs) => {
      expect(postgresTypeToFieldType(dataType, udtName)).toEqual({
        unsupported: shownAs,
      });
    },
  );
});
