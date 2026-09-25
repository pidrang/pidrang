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
});
