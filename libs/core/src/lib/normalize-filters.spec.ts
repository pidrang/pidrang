import { normalizeFilters } from './normalize-filters';

describe('normalizeFilters', () => {
  it('returns no filters when there are none', () => {
    expect(normalizeFilters(undefined)).toEqual([]);
    expect(normalizeFilters({})).toEqual([]);
    expect(normalizeFilters([])).toEqual([]);
  });

  it('keeps a filter list as is, in a copy the provider may change', () => {
    const filters = [{ field: 'price', operator: 'gte' as const, value: 10 }];

    const normalized = normalizeFilters(filters);
    normalized.push({ field: 'name', operator: 'null', value: true });

    expect(normalized[0]).toEqual(filters[0]);
    expect(filters).toHaveLength(1);
  });

  it('turns a legacy record into equality filters', () => {
    expect(normalizeFilters({ in_stock: true, name: 'Mouse' })).toEqual([
      { field: 'in_stock', operator: 'eq', value: true },
      { field: 'name', operator: 'eq', value: 'Mouse' },
    ]);
  });

  it('turns a legacy null into an is-null filter and skips undefined', () => {
    expect(normalizeFilters({ deleted_at: null, name: undefined })).toEqual([
      { field: 'deleted_at', operator: 'null', value: true },
    ]);
  });

  it('returns no filters for null', () => {
    expect(normalizeFilters(null as never)).toEqual([]);
  });

  it.each([
    ['a string', 'price'],
    ['a number', 42],
    ['a boolean', true],
    ['a function', () => undefined],
    ['a date', new Date(0)],
    ['a map', new Map([['price', 10]])],
    [
      'a class instance',
      new (class Query {
        in_stock = true;
      })(),
    ],
  ])('rejects %s instead of reading its keys as columns', (_label, filters) => {
    expect(() => normalizeFilters(filters as never)).toThrow(
      'Invalid filters: expected an array of filters or a plain object',
    );
  });

  it('accepts a record without a prototype', () => {
    const filters = Object.assign(Object.create(null), { price: 10 });

    expect(normalizeFilters(filters)).toEqual([
      { field: 'price', operator: 'eq', value: 10 },
    ]);
  });

  it('asks to wrap a single filter in an array', () => {
    expect(() =>
      normalizeFilters({
        field: 'name',
        operator: 'contains',
        value: 'a',
      } as never),
    ).toThrow('wrap the filter in an array');
  });
});
