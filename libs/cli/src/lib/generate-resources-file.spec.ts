import { generateResourcesFile } from './generate-resources-file';
import { GenerationPlan } from './generation-plan';

describe('generateResourcesFile', () => {
  it('generates a Resource literal with all fields and actions', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'products',
          fields: [
            { name: 'id', type: 'number' },
            { name: 'name', type: 'text' },
            { name: 'in_stock', type: 'boolean' },
          ],
          actions: ['list', 'create', 'show', 'edit', 'delete'],
          hiddenFields: [],
        },
      ],
    };

    expect(generateResourcesFile(plan)).toBe(
      `import { Resource } from '@pidrang/core';

export const resources: Resource[] = [
  {
    name: 'products',
    fields: [
      { name: 'id', type: 'number' },
      { name: 'name', type: 'text' },
      { name: 'in_stock', type: 'boolean' },
    ],
    list: true,
    create: true,
    show: true,
    edit: true,
    delete: true,
  },
];
`,
    );
  });

  it('sets unselected actions to false', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'orders',
          fields: [{ name: 'id', type: 'number' }],
          actions: ['list', 'show'],
          hiddenFields: [],
        },
      ],
    };

    const output = generateResourcesFile(plan);

    expect(output).toContain('list: true,');
    expect(output).toContain('show: true,');
    expect(output).toContain('create: false,');
    expect(output).toContain('edit: false,');
    expect(output).toContain('delete: false,');
  });

  it('marks fields listed in hiddenFields as hidden', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'users',
          fields: [
            { name: 'id', type: 'number' },
            { name: 'password_hash', type: 'text' },
          ],
          actions: ['list'],
          hiddenFields: ['password_hash'],
        },
      ],
    };

    const output = generateResourcesFile(plan);

    expect(output).toContain(`{ name: 'id', type: 'number' },`);
    expect(output).toContain(
      `{ name: 'password_hash', type: 'text', hidden: true },`,
    );
  });

  it('emits readOnly, nullable and hasDefault only when the field carries them', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'products',
          fields: [
            { name: 'id', type: 'numeric', readOnly: true },
            { name: 'name', type: 'text' },
            { name: 'status', type: 'text', nullable: true, hasDefault: true },
          ],
          actions: ['list'],
          hiddenFields: [],
        },
      ],
    };

    const output = generateResourcesFile(plan);

    expect(output).toContain(
      `{ name: 'id', type: 'numeric', readOnly: true },`,
    );
    expect(output).toContain(`{ name: 'name', type: 'text' },`);
    expect(output).toContain(
      `{ name: 'status', type: 'text', nullable: true, hasDefault: true },`,
    );
  });

  it('generates one Resource literal per planned table', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'products',
          fields: [{ name: 'id', type: 'number' }],
          actions: ['list'],
          hiddenFields: [],
        },
        {
          table: 'orders',
          fields: [{ name: 'id', type: 'number' }],
          actions: ['list'],
          hiddenFields: [],
        },
      ],
    };

    const output = generateResourcesFile(plan);

    expect(output).toContain(`name: 'products'`);
    expect(output).toContain(`name: 'orders'`);
  });

  it('sorts newest first when created_at is a timestamp', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'products',
          fields: [
            { name: 'id', type: 'text', readOnly: true },
            { name: 'created_at', type: 'timestamp', hasDefault: true },
          ],
          actions: ['list'],
          hiddenFields: [],
        },
      ],
    };

    expect(generateResourcesFile(plan)).toBe(
      `import { Resource } from '@pidrang/core';

export const resources: Resource[] = [
  {
    name: 'products',
    fields: [
      { name: 'id', type: 'text', readOnly: true },
      { name: 'created_at', type: 'timestamp', hasDefault: true },
    ],
    defaultSorters: [
      { field: 'created_at', order: 'desc' },
      { field: 'id', order: 'asc' },
    ],
    list: true,
    create: false,
    show: false,
    edit: false,
    delete: false,
  },
];
`,
    );
  });

  it.each([
    ['a timestamp', 'timestamp', [], true],
    ['a date', 'date', [], true],
    ['a hidden timestamp', 'timestamp', ['created_at'], true],
    ['a hidden date', 'date', ['created_at'], true],
    ['text', 'text', [], false],
    ['a number', 'number', [], false],
    ['a time of day', 'time', [], false],
  ] as const)(
    'with created_at as %s, emits default sorters: %s',
    (_label, type, hiddenFields, expected) => {
      const plan: GenerationPlan = {
        providerId: 'supabase',
        tables: [
          {
            table: 'products',
            fields: [
              { name: 'id', type: 'number' },
              { name: 'created_at', type },
            ],
            actions: ['list'],
            hiddenFields: [...hiddenFields],
          },
        ],
      };

      expect(generateResourcesFile(plan).includes('defaultSorters')).toBe(
        expected,
      );
    },
  );

  it('emits no default sorters when the table has no created_at field', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'tags',
          fields: [
            { name: 'id', type: 'number' },
            { name: 'createdAt', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
          ],
          actions: ['list'],
          hiddenFields: [],
        },
      ],
    };

    expect(generateResourcesFile(plan)).not.toContain('defaultSorters');
  });

  it('decides the default sorters per table', () => {
    const plan: GenerationPlan = {
      providerId: 'supabase',
      tables: [
        {
          table: 'tags',
          fields: [{ name: 'id', type: 'number' }],
          actions: ['list'],
          hiddenFields: [],
        },
        {
          table: 'orders',
          fields: [
            { name: 'id', type: 'number' },
            { name: 'created_at', type: 'timestamp' },
          ],
          actions: ['list'],
          hiddenFields: [],
        },
      ],
    };

    const [tags, orders] = generateResourcesFile(plan).split("name: 'orders'");

    expect(tags).not.toContain('defaultSorters');
    expect(orders).toContain('defaultSorters');
  });
});
