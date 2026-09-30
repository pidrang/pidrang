import { rejectUnsupportedFilters } from './reject-unsupported-filters';

describe('rejectUnsupportedFilters', () => {
  it('accepts filters whose operators are supported', () => {
    expect(() =>
      rejectUnsupportedFilters(
        [{ field: 'name', operator: 'eq', value: 'a' }],
        ['eq', 'in'],
      ),
    ).not.toThrow();
  });

  it('names the field and operator it cannot apply', () => {
    expect(() =>
      rejectUnsupportedFilters(
        [{ field: 'name', operator: 'contains', value: 'a' }],
        ['eq', 'in'],
      ),
    ).toThrow('Unsupported filter operator "contains" on field "name"');
  });
});
