import { describeTable } from './describe-table';
import { IntrospectedColumn } from './introspected-column';

const id: IntrospectedColumn = {
  name: 'id',
  type: 'text',
  readOnly: true,
  hasDefault: true,
};

const title: IntrospectedColumn = { name: 'title', type: 'text' };

describe('describeTable', () => {
  it('keeps supported columns as fields with their flags, in order', () => {
    expect(
      describeTable('products', [
        id,
        { name: 'name', type: 'text' },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'price', type: 'numeric', hasDefault: true },
      ]),
    ).toEqual({
      fields: [
        { name: 'id', type: 'text', readOnly: true, hasDefault: true },
        { name: 'name', type: 'text' },
        { name: 'notes', type: 'text', nullable: true },
        { name: 'price', type: 'numeric', hasDefault: true },
      ],
      excludedColumns: [],
      unavailableActions: [],
    });
  });

  it.each(['created_at', 'updated_at'])(
    'marks %s read-only when it is a timestamp with a default',
    (name) => {
      const result = describeTable('products', [
        id,
        title,
        { name, type: 'timestamp', hasDefault: true },
      ]);
      expect(
        result.fields.map((field) => [field.name, field.readOnly]),
      ).toEqual([
        ['id', true],
        ['title', undefined],
        [name, true],
      ]);
      expect(result.unavailableActions).toEqual([]);
    },
  );

  it.each([
    ['without a default', { name: 'created_at', type: 'timestamp' }],
    ['as a date', { name: 'created_at', type: 'date', hasDefault: true }],
    ['as text', { name: 'created_at', type: 'text', hasDefault: true }],
    [
      'under another name',
      { name: 'deleted_at', type: 'timestamp', hasDefault: true },
    ],
  ] as const)('keeps an audit-like column %s editable', (_, column) => {
    const result = describeTable('products', [id, { ...column }]);
    expect(result.fields[1]).toEqual({ ...column });
  });

  const omissibleCells: [string, Partial<IntrospectedColumn>][] = [
    ['nullable', { nullable: true }],
    ['with a default', { hasDefault: true }],
    ['read-only', { readOnly: true }],
    ['nullable with a default', { nullable: true, hasDefault: true }],
    ['nullable and read-only', { nullable: true, readOnly: true }],
    ['read-only with a default', { readOnly: true, hasDefault: true }],
    [
      'nullable, read-only, with a default',
      { nullable: true, readOnly: true, hasDefault: true },
    ],
  ];

  it.each(omissibleCells)(
    'leaves out an unsupported column that is %s and keeps create available',
    (_, flags) => {
      const result = describeTable('products', [
        id,
        title,
        { name: 'meta', type: { unsupported: 'jsonb' }, ...flags },
      ]);
      expect(result.fields.map((field) => field.name)).toEqual(['id', 'title']);
      expect(result.excludedColumns).toEqual([
        { name: 'meta', reason: 'jsonb' },
      ]);
      expect(result.unavailableActions).toEqual([]);
    },
  );

  it('leaves out a NOT NULL unsupported column with no default and makes create unavailable', () => {
    const result = describeTable('products', [
      id,
      title,
      { name: 'meta', type: { unsupported: 'jsonb' } },
    ]);
    expect(result.excludedColumns).toEqual([{ name: 'meta', reason: 'jsonb' }]);
    expect(result.unavailableActions).toEqual([
      {
        action: 'create',
        reason: expect.stringContaining('"meta" is left out (jsonb)'),
      },
    ]);
  });

  it('never blocks create because of a supported NOT NULL column with no default', () => {
    expect(describeTable('products', [id, title]).unavailableActions).toEqual(
      [],
    );
  });

  it('keeps the unavailable actions the strategy already found', () => {
    const result = describeTable(
      'products_view',
      [id, title, { name: 'meta', type: { unsupported: 'jsonb' } }],
      [{ action: 'edit', reason: 'read-only view' }],
    );
    expect(result.unavailableActions.map((entry) => entry.action)).toEqual([
      'edit',
      'create',
    ]);
  });

  it.each([
    ['only the read-only id', [id]],
    [
      'only read-only columns',
      [id, { name: 'doubled', type: 'number', readOnly: true, nullable: true }],
    ],
    [
      'only the id once unsupported columns are left out',
      [id, { name: 'payload', type: { unsupported: 'jsonb' }, nullable: true }],
    ],
  ] as [string, IntrospectedColumn[]][])(
    'makes edit unavailable when the table keeps %s',
    (_, columns) => {
      expect(describeTable('events', columns).unavailableActions).toEqual([
        {
          action: 'edit',
          reason: 'no column of this table can be edited in a generated form',
        },
      ]);
    },
  );

  it.each([
    ['a nullable column', { name: 'note', type: 'text', nullable: true }],
    [
      'a column with a default',
      { name: 'n', type: 'number', hasDefault: true },
    ],
    ['a NOT NULL column', { name: 'title', type: 'text' }],
  ] as [string, IntrospectedColumn][])(
    'keeps edit available with one writable column: %s',
    (_, column) => {
      expect(describeTable('events', [id, column]).unavailableActions).toEqual(
        [],
      );
    },
  );

  it('refuses an "id" column of an unsupported type instead of leaving it out', () => {
    expect(() =>
      describeTable('products', [
        { name: 'id', type: { unsupported: 'jsonb' }, readOnly: true },
      ]),
    ).toThrow('Table "products" has an "id" column pidrang cannot use (jsonb)');
  });
});
