import { validateListParams } from './validate-list-params';

describe('validateListParams', () => {
  it('accepts missing params and positive integer pagination', () => {
    expect(() => validateListParams(undefined)).not.toThrow();
    expect(() => validateListParams({})).not.toThrow();
    expect(() =>
      validateListParams({ pagination: { current: 3, pageSize: 10 } }),
    ).not.toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects current page %s',
    (current) => {
      expect(() => validateListParams({ pagination: { current } })).toThrow(
        'Invalid pagination.current',
      );
    },
  );

  it.each([0, -10, 2.5, Number.NaN])('rejects page size %s', (pageSize) => {
    expect(() => validateListParams({ pagination: { pageSize } })).toThrow(
      'Invalid pagination.pageSize',
    );
  });

  it.each([
    [{ field: 'price', operator: 'eq', value: 10 }],
    [{ field: 'name', operator: 'ne', value: 'Mouse' }],
    [{ field: 'price', operator: 'lt', value: 10 }],
    [{ field: 'created_at', operator: 'gte', value: '2026-01-01' }],
    [{ field: 'in_stock', operator: 'eq', value: false }],
    [{ field: 'name', operator: 'in', value: ['Mouse', 'Keyboard'] }],
    [{ field: 'name', operator: 'in', value: [] }],
    [{ field: 'name', operator: 'contains', value: 'ous' }],
    [{ field: 'deleted_at', operator: 'null', value: true }],
    [{ field: 'deleted_at', operator: 'null', value: false }],
  ])('accepts filter %o', (filter) => {
    expect(() =>
      validateListParams({ filters: [filter] as never }),
    ).not.toThrow();
  });

  it.each([
    [{ field: '', operator: 'eq', value: 1 }, 'field'],
    [{ field: 'price', operator: 'between', value: 1 }, 'operator'],
    [{ field: 'price', operator: 'eq', value: null }, 'null operator'],
    [{ field: 'price', operator: 'eq', value: { a: 1 } }, 'value'],
    [{ field: 'price', operator: 'gt', value: Number.NaN }, 'value'],
    [{ field: 'name', operator: 'in', value: 'Mouse' }, 'array'],
    [{ field: 'name', operator: 'in', value: [null] }, 'value'],
    [{ field: 'name', operator: 'contains', value: 3 }, 'string'],
    [{ field: 'deleted_at', operator: 'null', value: 'yes' }, 'boolean'],
  ])('rejects filter %o with a message about its %s', (filter, topic) => {
    expect(() => validateListParams({ filters: [filter] as never })).toThrow(
      topic,
    );
  });

  it('validates legacy record filters after normalizing them', () => {
    expect(() =>
      validateListParams({ filters: { name: 'Mouse', deleted_at: null } }),
    ).not.toThrow();
    expect(() =>
      validateListParams({ filters: { name: { a: 1 } } as never }),
    ).toThrow('Invalid filter');
  });

  it.each([[[null]], [['price']], [[42]]])(
    'rejects a filter entry that is not an object: %o',
    (filters) => {
      expect(() => validateListParams({ filters: filters as never })).toThrow(
        'Invalid filter: each filter must be an object',
      );
    },
  );

  it('treats null filters like no filters', () => {
    expect(() => validateListParams({ filters: null as never })).not.toThrow();
  });

  it('accepts sorters on a field with a direction', () => {
    expect(() =>
      validateListParams({ sorters: [{ field: 'price', order: 'desc' }] }),
    ).not.toThrow();
  });

  it.each([
    ['a string', 'price'],
    ['an object', { field: 'price', order: 'asc' }],
  ])('rejects sorters given as %s', (_label, sorters) => {
    expect(() => validateListParams({ sorters: sorters as never })).toThrow(
      'Invalid sorters: expected an array',
    );
  });

  it.each([
    ['no direction', { field: 'price' }],
    ['an unknown direction', { field: 'price', order: 'up' }],
    ['an empty field', { field: '', order: 'asc' }],
    ['no field', { order: 'asc' }],
    ['null', null],
  ])('rejects a sorter with %s', (_label, sorter) => {
    expect(() => validateListParams({ sorters: [sorter as never] })).toThrow(
      'Invalid sorter',
    );
  });

  it.each([
    ['a string', 'x'],
    ['a number', 5],
    ['an array', [1, 10]],
  ])('rejects pagination given as %s', (_label, pagination) => {
    expect(() =>
      validateListParams({ pagination: pagination as never }),
    ).toThrow('Invalid pagination: expected an object');
  });

  it('treats null sorters like no sorters', () => {
    expect(() => validateListParams({ sorters: null as never })).not.toThrow();
  });
});
