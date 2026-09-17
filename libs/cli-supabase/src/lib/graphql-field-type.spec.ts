import { graphqlScalarToFieldType } from './graphql-field-type';

describe('graphqlScalarToFieldType', () => {
  it('maps Boolean', () => {
    expect(graphqlScalarToFieldType('Boolean')).toBe('boolean');
  });

  it('maps numeric scalars to number', () => {
    expect(graphqlScalarToFieldType('Int')).toBe('number');
    expect(graphqlScalarToFieldType('BigInt')).toBe('number');
    expect(graphqlScalarToFieldType('Float')).toBe('number');
    expect(graphqlScalarToFieldType('BigFloat')).toBe('number');
  });

  it('maps date scalars to date', () => {
    expect(graphqlScalarToFieldType('Date')).toBe('date');
    expect(graphqlScalarToFieldType('Datetime')).toBe('date');
  });

  it('falls back to text for unknown scalars', () => {
    expect(graphqlScalarToFieldType('String')).toBe('text');
    expect(graphqlScalarToFieldType('UUID')).toBe('text');
    expect(graphqlScalarToFieldType('JSON')).toBe('text');
  });
});
