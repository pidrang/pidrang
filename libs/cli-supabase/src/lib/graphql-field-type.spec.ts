import { graphqlScalarToFieldType } from './graphql-field-type';

describe('graphqlScalarToFieldType', () => {
  it('maps Boolean', () => {
    expect(graphqlScalarToFieldType('SCALAR', 'Boolean')).toBe('boolean');
  });

  it('maps safe numeric scalars to number', () => {
    expect(graphqlScalarToFieldType('SCALAR', 'Int')).toBe('number');
    expect(graphqlScalarToFieldType('SCALAR', 'Float')).toBe('number');
  });

  it('maps precision-sensitive numeric scalars to numeric, never number', () => {
    expect(graphqlScalarToFieldType('SCALAR', 'BigInt')).toBe('numeric');
    expect(graphqlScalarToFieldType('SCALAR', 'BigFloat')).toBe('numeric');
  });

  it('maps Date to date, Datetime to timestamp, Time to time', () => {
    expect(graphqlScalarToFieldType('SCALAR', 'Date')).toBe('date');
    expect(graphqlScalarToFieldType('SCALAR', 'Datetime')).toBe('timestamp');
    expect(graphqlScalarToFieldType('SCALAR', 'Time')).toBe('time');
  });

  it('maps String and UUID to text', () => {
    expect(graphqlScalarToFieldType('SCALAR', 'String')).toBe('text');
    expect(graphqlScalarToFieldType('SCALAR', 'UUID')).toBe('text');
  });

  it.each([
    ['JSON', 'SCALAR', 'JSON', 'JSON'],
    ['an Opaque scalar', 'SCALAR', 'Opaque', 'Opaque'],
    ['an enum', 'ENUM', 'order_status', 'enum order_status'],
    ['a list', 'LIST', 'String', 'a list of String'],
    ['an unknown scalar', 'SCALAR', 'Cursor', 'Cursor'],
  ])('reports %s as unsupported', (_, kind, typeName, shownAs) => {
    expect(graphqlScalarToFieldType(kind, typeName)).toEqual({
      unsupported: shownAs,
    });
  });
});
