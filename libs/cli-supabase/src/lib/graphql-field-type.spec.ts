import { graphqlScalarToFieldType } from './graphql-field-type';

describe('graphqlScalarToFieldType', () => {
  it('maps Boolean', () => {
    expect(graphqlScalarToFieldType('Boolean')).toBe('boolean');
  });

  it('maps safe numeric scalars to number', () => {
    expect(graphqlScalarToFieldType('Int')).toBe('number');
    expect(graphqlScalarToFieldType('Float')).toBe('number');
  });

  it('maps precision-sensitive numeric scalars to numeric, never number', () => {
    expect(graphqlScalarToFieldType('BigInt')).toBe('numeric');
    expect(graphqlScalarToFieldType('BigFloat')).toBe('numeric');
  });

  it('maps Date to date, Datetime to timestamp, Time to time', () => {
    expect(graphqlScalarToFieldType('Date')).toBe('date');
    expect(graphqlScalarToFieldType('Datetime')).toBe('timestamp');
    expect(graphqlScalarToFieldType('Time')).toBe('time');
  });

  it('falls back to text for unknown scalars', () => {
    expect(graphqlScalarToFieldType('String')).toBe('text');
    expect(graphqlScalarToFieldType('UUID')).toBe('text');
    expect(graphqlScalarToFieldType('JSON')).toBe('text');
  });
});
