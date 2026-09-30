import { normalizeFilters } from './normalize-filters';

describe('normalizeFilters', () => {
  it('returns no filters when there are none', () => {
    expect(normalizeFilters(undefined)).toEqual([]);
    expect(normalizeFilters({})).toEqual([]);
    expect(normalizeFilters([])).toEqual([]);
  });

  it('keeps a filter list as is', () => {
    const filters = [{ field: 'price', operator: 'gte' as const, value: 10 }];

    expect(normalizeFilters(filters)).toEqual(filters);
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
});
