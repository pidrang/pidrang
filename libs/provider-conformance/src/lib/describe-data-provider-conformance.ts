import {
  DataProvider,
  FilterOperator,
  ListParams,
  PidrangError,
  normalizeFilters,
} from '@pidrang/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConformanceRow } from './conformance-row';
import { CONFORMANCE_ROWS } from './conformance-rows';

export interface ConformanceTarget {
  resource: string;
  setup(): Promise<DataProvider>;
  teardown?(): Promise<void>;
  unsupported?: readonly FilterOperator[];
}

const MISSING_ID = '00000000-0000-4000-8000-0000000000ff';

const VALID_VALUES: Record<FilterOperator, unknown> = {
  eq: 'x',
  ne: 'x',
  lt: 'x',
  lte: 'x',
  gt: 'x',
  gte: 'x',
  in: ['x'],
  contains: 'x',
  null: true,
};

function ids(...numbers: number[]): string[] {
  return numbers.map((n) => CONFORMANCE_ROWS[n - 1].id);
}

const FILTER_CASES: {
  name: string;
  filters: ListParams['filters'];
  expected: string[];
}[] = [
  {
    name: 'eq on a string',
    filters: [{ field: 'name', operator: 'eq', value: 'Mouse' }],
    expected: ids(2),
  },
  {
    name: 'eq on a boolean',
    filters: [{ field: 'in_stock', operator: 'eq', value: false }],
    expected: ids(3, 5),
  },
  {
    name: 'ne, which never matches a null value',
    filters: [{ field: 'note', operator: 'ne', value: 'sticker' }],
    expected: ids(1, 3, 6),
  },
  {
    name: 'lt and gte combined as AND',
    filters: [
      { field: 'price', operator: 'gte', value: 10 },
      { field: 'price', operator: 'lt', value: 50 },
    ],
    expected: ids(2, 3, 4),
  },
  {
    name: 'lte and gt',
    filters: [
      { field: 'price', operator: 'gt', value: 10 },
      { field: 'price', operator: 'lte', value: 50 },
    ],
    expected: ids(1, 2),
  },
  {
    name: 'in',
    filters: [{ field: 'price', operator: 'in', value: [2, 200] }],
    expected: ids(5, 6),
  },
  {
    name: 'in with an empty list, which matches nothing',
    filters: [{ field: 'price', operator: 'in', value: [] }],
    expected: [],
  },
  {
    name: 'contains, case-insensitive',
    filters: [{ field: 'name', operator: 'contains', value: 'MOUSE' }],
    expected: ids(2, 3),
  },
  {
    name: 'contains with a literal %',
    filters: [{ field: 'name', operator: 'contains', value: '0%' }],
    expected: ids(4),
  },
  {
    name: 'contains with a literal _',
    filters: [{ field: 'name', operator: 'contains', value: 'e_c' }],
    expected: ids(5),
  },
  {
    name: 'contains with a literal *',
    filters: [{ field: 'name', operator: 'contains', value: '*' }],
    expected: [],
  },
  {
    name: 'contains with a literal .',
    filters: [{ field: 'name', operator: 'contains', value: '.' }],
    expected: [],
  },
  {
    name: 'in with a value holding a comma and quotes',
    filters: [
      {
        field: 'name',
        operator: 'in',
        value: ['a,"b"\\c', '100% cotton cover'],
      },
    ],
    expected: ids(4),
  },
  {
    name: 'null true',
    filters: [{ field: 'note', operator: 'null', value: true }],
    expected: ids(2, 4),
  },
  {
    name: 'null false',
    filters: [{ field: 'note', operator: 'null', value: false }],
    expected: ids(1, 3, 5, 6),
  },
  {
    name: 'a legacy equality record',
    filters: { in_stock: true, price: 10 },
    expected: ids(4),
  },
  {
    name: 'a legacy null value, read as is-null',
    filters: { note: null },
    expected: ids(2, 4),
  },
];

export function describeDataProviderConformance(
  name: string,
  target: ConformanceTarget,
): void {
  describe(`${name} data provider conformance`, () => {
    let provider: DataProvider;

    beforeEach(async () => {
      provider = await target.setup();
    });

    afterEach(async () => {
      await target.teardown?.();
    });

    const list = (params?: ListParams) =>
      provider.getList<ConformanceRow>(target.resource, params);

    it('lists the first page ordered by id, with the full total', async () => {
      const result = await list();

      expect(result.total).toBe(CONFORMANCE_ROWS.length);
      expect(result.data.map((row) => row.id)).toEqual(
        CONFORMANCE_ROWS.map((row) => row.id),
      );
    });

    it('pages with a 1-based current page and keeps the total', async () => {
      const result = await list({ pagination: { current: 2, pageSize: 2 } });

      expect(result.total).toBe(CONFORMANCE_ROWS.length);
      expect(result.data.map((row) => row.id)).toEqual(ids(3, 4));
    });

    it('returns an empty page past the end', async () => {
      const result = await list({ pagination: { current: 9, pageSize: 2 } });

      expect(result).toEqual({ data: [], total: CONFORMANCE_ROWS.length });
    });

    it('sorts by a field and breaks ties by id', async () => {
      const result = await list({
        sorters: [{ field: 'price', order: 'desc' }],
      });

      expect(result.data.map((row) => row.id)).toEqual(ids(6, 1, 2, 3, 4, 5));
    });

    for (const filterCase of FILTER_CASES) {
      const supported = normalizeFilters(filterCase.filters).every(
        (filter) => !target.unsupported?.includes(filter.operator),
      );
      if (supported) {
        it(`filters with ${filterCase.name}`, async () => {
          const result = await list({ filters: filterCase.filters });

          expect(result.data.map((row) => row.id)).toEqual(filterCase.expected);
          expect(result.total).toBe(filterCase.expected.length);
        });
      }
    }

    for (const operator of target.unsupported ?? []) {
      it(`rejects the unsupported ${operator} operator before querying`, async () => {
        await expect(
          list({
            filters: [
              { field: 'name', operator, value: VALID_VALUES[operator] },
            ],
          }),
        ).rejects.toThrow(`Unsupported filter operator "${operator}"`);
      });
    }

    it('rejects an invalid filter', async () => {
      await expect(
        list({
          filters: [{ field: 'price', operator: 'eq', value: null }],
        }),
      ).rejects.toThrow('Invalid filter');
    });

    it('reads one record', async () => {
      await expect(
        provider.getOne<ConformanceRow>(target.resource, {
          id: CONFORMANCE_ROWS[1].id,
        }),
      ).resolves.toEqual(CONFORMANCE_ROWS[1]);
    });

    it('creates, updates and deletes, returning the affected record', async () => {
      const created = await provider.create<ConformanceRow>(target.resource, {
        data: { name: 'Webcam', price: 70, in_stock: true, note: null },
      });
      expect(created).toMatchObject({ name: 'Webcam', price: 70 });
      expect(typeof created.id).toBe('string');

      const updated = await provider.update<ConformanceRow>(target.resource, {
        id: created.id,
        data: { price: 65 },
      });
      expect(updated).toMatchObject({ id: created.id, price: 65 });

      const deleted = await provider.delete<ConformanceRow>(target.resource, {
        id: created.id,
      });
      expect(deleted).toMatchObject({ id: created.id });
      expect((await list()).total).toBe(CONFORMANCE_ROWS.length);
    });

    it.each(['getOne', 'update', 'delete'] as const)(
      'reports a missing record on %s as not-found',
      async (method) => {
        const call =
          method === 'update'
            ? provider.update(target.resource, {
                id: MISSING_ID,
                data: { price: 1 },
              })
            : provider[method](target.resource, { id: MISSING_ID });

        await expect(call).rejects.toSatisfy(
          (error: unknown) =>
            error instanceof PidrangError && error.category === 'not-found',
        );
      },
    );
  });
}
