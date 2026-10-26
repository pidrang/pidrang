import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as typescript from 'typescript';
import { TablePlan, generateResourcesFile } from '@pidrang/cli';
import { editResources } from './edit-resources';

const NO_CORE = { root: join(tmpdir(), 'pidrang-no-app'), tsConfig: null };
const PROJECT: { root: string; tsConfig: string | null } = {
  root: '',
  tsConfig: null,
};
const CORE_TYPES = [
  "export interface Field { name: string; label?: string; type: 'text' | 'number'; readOnly?: boolean }",
  'export interface Resource { name: string; label?: string; fields?: readonly Field[]; list?: boolean; create?: boolean; show?: boolean; edit?: boolean; delete?: boolean }',
  'export interface PidrangConfig { resources: Resource[] }',
  '',
].join('\n');
const IMPORT = "import { Resource } from '@pidrang/core';\n";

async function writeFiles(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content, 'utf8');
  }
}

function coreFiles(): Record<string, string> {
  return {
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
    'node_modules/@pidrang/core/package.json': JSON.stringify({
      name: '@pidrang/core',
      types: 'index.d.ts',
    }),
    'node_modules/@pidrang/core/index.d.ts': CORE_TYPES,
  };
}

beforeAll(async () => {
  PROJECT.root = await mkdtemp(join(tmpdir(), 'pidrang-resources-'));
  await writeFiles(PROJECT.root, coreFiles());
});

afterAll(async () => {
  await rm(PROJECT.root, { recursive: true, force: true });
});
const PATH = 'src/app/resources.ts';

function table(name: string): TablePlan {
  return {
    table: name,
    fields: [
      { name: 'id', type: 'number', readOnly: true },
      { name: 'name', type: 'text' },
    ],
    actions: ['list', 'show'],
    hiddenFields: [],
    readsNeedSignIn: false,
  };
}

function generated(...names: string[]): string {
  return generateResourcesFile({
    providerId: 'fake',
    tables: names.map(table),
  });
}

function resourceNames(source: string): string[] {
  const file = typescript.createSourceFile(
    PATH,
    source,
    typescript.ScriptTarget.Latest,
    true,
  );
  const diagnostics = typescript.transpileModule(source, {
    reportDiagnostics: true,
  }).diagnostics;
  expect(diagnostics).toEqual([]);
  const statement = file.statements.find(typescript.isVariableStatement);
  const initializer = statement?.declarationList.declarations[0].initializer;
  if (!initializer || !typescript.isArrayLiteralExpression(initializer)) {
    throw new Error('no resources array');
  }
  return initializer.elements.map((element) => {
    if (!typescript.isObjectLiteralExpression(element)) {
      throw new Error('not an object literal');
    }
    const name = element.properties.find(
      (property): property is typescript.PropertyAssignment =>
        typescript.isPropertyAssignment(property) &&
        typescript.isIdentifier(property.name) &&
        property.name.text === 'name',
    );
    if (!name || !typescript.isStringLiteral(name.initializer)) {
      throw new Error('no literal name');
    }
    return name.initializer.text;
  });
}

function edited(source: string, wanted: string): string {
  const result = editResources(typescript, PROJECT, PATH, source, wanted);
  if (result.kind !== 'edited') {
    throw new Error(`expected an edit, got ${result.kind}`);
  }
  return result.content;
}

function literal(source: string, name: string): string {
  const start = source.indexOf(`  {\n    name: '${name}',`);
  const end = source.indexOf('\n  },', start);
  if (start < 0 || end < 0) {
    throw new Error(`no ${name} literal`);
  }
  return source.slice(start, end + '\n  },'.length);
}

describe('editResources', () => {
  it('appends a new table after the existing ones and leaves them byte for byte', () => {
    const first = generated('products');

    const after = edited(first, generated('products', 'orders'));

    expect(resourceNames(after)).toEqual(['products', 'orders']);
    expect(literal(after, 'products')).toBe(literal(first, 'products'));
    expect(literal(after, 'orders')).toBe(
      literal(generated('orders'), 'orders'),
    );
    expect(after.startsWith(first.slice(0, first.lastIndexOf('];')))).toBe(
      true,
    );
  });

  it('keeps a products literal edited by hand', () => {
    const first = generated('products')
      .replace("label: 'Products'", "label: 'Catalog'")
      .replace(
        "      { name: 'name', label: 'Name', type: 'text' },\n",
        "      { name: 'name', label: 'Name', type: 'text' },\n      { name: 'sku', label: 'SKU', type: 'text', readOnly: true },\n",
      );

    const result = editResources(
      typescript,
      PROJECT,
      PATH,
      first,
      generated('products', 'orders'),
    );

    expect(result.kind).toBe('edited');
    expect(result.kept).toEqual(['products']);
    const after = result.kind === 'edited' ? result.content : '';
    expect(after).toContain("label: 'Catalog'");
    expect(after).toContain("{ name: 'sku', label: 'SKU'");
    expect(resourceNames(after)).toEqual(['products', 'orders']);
  });

  it('changes nothing when every selected table is already there', () => {
    const result = editResources(
      typescript,
      PROJECT,
      PATH,
      generated('products', 'orders'),
      generated('orders'),
    );

    expect(result).toEqual({ kind: 'unchanged', kept: ['orders'] });
  });

  it('never removes a table left out of the selection', () => {
    const after = edited(generated('products'), generated('orders'));

    expect(resourceNames(after)).toEqual(['products', 'orders']);
  });

  it('adds several tables in the order the answers give', () => {
    const after = edited(
      generated('products'),
      generated('orders', 'products', 'customers'),
    );

    expect(resourceNames(after)).toEqual(['products', 'orders', 'customers']);
  });

  it('adds a comma after a last element written without one', () => {
    const source = `import { Resource } from '@pidrang/core';

export const resources: Resource[] = [
  { name: 'products' }
];
`;

    const after = edited(source, generated('orders'));

    expect(resourceNames(after)).toEqual(['products', 'orders']);
    expect(after).toContain("  { name: 'products' },\n");
  });

  it('keeps a comment after the last element in place', () => {
    const source = `${IMPORT}export const resources: Resource[] = [
  { name: 'products' }, // the catalog
];
`;

    const after = edited(source, generated('orders'));

    expect(resourceNames(after)).toEqual(['products', 'orders']);
    expect(after).toContain("{ name: 'products' }, // the catalog");
  });

  it.each([
    ['after a comma', "  { name: 'products' }, /* the catalog */\n"],
    ['without a comma', "  { name: 'products' } /* the catalog */\n"],
    ['over two lines', "  { name: 'products' }, /* the\n  catalog */\n"],
  ])('keeps a block comment %s next to the last element', (_, element) => {
    const source = `${IMPORT}export const resources: Resource[] = [\n${element}];\n`;

    const after = edited(source, generated('orders'));

    expect(resourceNames(after)).toEqual(['products', 'orders']);
    expect(after.indexOf('catalog */')).toBeLessThan(
      after.indexOf("name: 'orders'"),
    );
  });

  it.each([
    "export const resources = [{ name: 'products' }] as Resource[];\n",
    "export const resources = <Resource[]>[{ name: 'products' }];\n",
    "interface AppResource extends Resource { tenant: string }\nexport const resources = [{ name: 'products', tenant: 'shop' }] as AppResource[];\n",
  ])(
    'asks for a manual change on an array behind a type assertion: %s',
    (source) => {
      expect(
        editResources(
          typescript,
          PROJECT,
          PATH,
          IMPORT + source,
          generated('orders'),
        ),
      ).toMatchObject({
        kind: 'manual',
        reason:
          'the resources array has a type assertion, which would not check the new tables',
      });
    },
  );

  it.each([
    "export const resources = [{ name: 'products' }] as const satisfies Resource[];\n",
    "export const resources = [{ name: 'products' }] satisfies Resource[];\n",
  ])(
    'asks for a manual change when the new table changes the inferred type: %s',
    (source) => {
      expect(
        editResources(
          typescript,
          PROJECT,
          PATH,
          IMPORT + source,
          generated('orders'),
        ),
      ).toMatchObject({
        kind: 'manual',
        reason:
          'adding the tables would change the type of resources, which code that reads it may not expect',
      });
    },
  );

  it.each([
    IMPORT + "export const resources: Resource[] = [{ name: 'products' }];\n",
    IMPORT +
      "export const resources: Array<Resource> = [{ name: 'products' }];\n",
  ])('edits an array typed as a list of resources: %s', (source) => {
    const after = edited(source, generated('orders'));

    expect(after.indexOf("name: 'products'")).toBeLessThan(
      after.indexOf("name: 'orders'"),
    );
  });

  it('edits an array whose elements hold a tuple type', () => {
    const after = edited(
      IMPORT +
        "export const resources: Resource[] = [{ name: 'products', fields: [] as [] }];\n",
      generated('orders'),
    );

    expect(resourceNames(after)).toEqual(['products', 'orders']);
  });

  it('edits a file that only uses resources as a property name', () => {
    const source = `${IMPORT}const labels = { resources: 'Catalog' };

export const resources: Resource[] = [
  { name: 'products', label: labels.resources },
];
`;

    const after = edited(source, generated('orders'));

    expect(after.startsWith(source.slice(0, source.lastIndexOf('];')))).toBe(
      true,
    );
    expect(after).toContain("name: 'orders'");
  });

  it('fills an empty array', () => {
    const after = edited(
      IMPORT + 'export const resources: Resource[] = [];\n',
      generated('orders'),
    );

    expect(resourceNames(after)).toEqual(['orders']);
  });

  it('edits an array written on one line', () => {
    const after = edited(
      IMPORT + "export const resources: Resource[] = [{ name: 'products' }];\n",
      generated('orders'),
    );

    expect(resourceNames(after)).toEqual(['products', 'orders']);
  });

  it.each([
    [
      'a spread element',
      IMPORT +
        "export const resources: Resource[] = [...shared, { name: 'products' }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'an element held in a variable',
      IMPORT + 'export const resources: Resource[] = [products];\n',
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'an object spread that can override the name',
      IMPORT +
        "const overrides = { name: 'orders' };\nexport const resources: Resource[] = [{ name: 'products', ...overrides }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'a computed key',
      IMPORT +
        "export const resources: Resource[] = [{ name: 'products', [key]: 'orders' }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'two names in one element',
      IMPORT +
        "export const resources: Resource[] = [{ name: 'products', name: 'orders' }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'a name that is not a string literal',
      IMPORT + 'export const resources: Resource[] = [{ name: tableName }];\n',
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'an export alias',
      IMPORT +
        "const active: Resource[] = [{ name: 'products' }];\nexport { active as resources };\n",
      'no `export const resources = [...]` was found',
    ],
    [
      'a resources array that is not exported',
      IMPORT +
        "const resources: Resource[] = [{ name: 'products' }];\nexport { resources };\n",
      'no `export const resources = [...]` was found',
    ],
    [
      'a let declaration',
      IMPORT + "export let resources: Resource[] = [{ name: 'products' }];\n",
      'no `export const resources = [...]` was found',
    ],
    [
      'a push after the array',
      IMPORT +
        "export const resources: Resource[] = [{ name: 'products' }];\nresources.push({ name: 'orders', list: false });\n",
      'the resources array is read or changed elsewhere in the file',
    ],
    [
      'a name changed after the array',
      IMPORT +
        "export const resources: Resource[] = [{ name: 'products' }];\nresources[0].name = 'orders';\n",
      'the resources array is read or changed elsewhere in the file',
    ],
    [
      'an alias of the array',
      IMPORT +
        "export const resources: Resource[] = [{ name: 'products' }];\nconst all = resources;\nall.push({ name: 'orders' });\n",
      'the resources array is read or changed elsewhere in the file',
    ],
    [
      'a syntax error',
      IMPORT +
        "export const resources: Resource[] = [\n  { name: 'products' }\n  { name: 'orders' }\n];\n",
      'resources.ts has a syntax error',
    ],
  ])('asks for a manual change with %s', (_, source, reason) => {
    const result = editResources(
      typescript,
      PROJECT,
      PATH,
      source,
      generated('orders'),
    );

    expect(result.kind).toBe('manual');
    expect(result.kind === 'manual' ? result.reason : '').toBe(reason);
    expect(result.kept).toEqual([]);
  });

  it.each([
    ['another export', "export const tables = ['products'];\n"],
    ['no export at all', "const resources = [{ name: 'products' }];\n"],
    ['an empty file', ''],
    [
      'a destructured export of another name',
      'export const { tables } = { tables: [] };\n',
    ],
    ['a namespace export', "export * as tables from './tables';\n"],
    ['a star export', "export * from './tables';\n"],
    ['an export in a comment', '// export const resources = [];\n'],
    ['a longer name', 'export const resources$ = [];\n'],
    [
      'an alias exported under another name',
      "const resources = [{ name: 'products' }];\nexport { resources as tables };\n",
    ],
    [
      'a type-only export',
      'type resources = string[];\nexport type { resources };\n',
    ],
    ['an exported type', 'type resources = string[];\nexport { resources };\n'],
    [
      'a type exported as resources',
      'type Tables = string[];\nexport { Tables as resources };\n',
    ],
    [
      'an export in a block comment',
      "/*\nexport const resources = [];\n*/\nexport const tables = ['products'];\n",
    ],
    [
      'an export in a template string',
      'export const help = `\nexport const resources = [];\n`;\n',
    ],
    ['a declared export', 'export declare const resources: string[];\n'],
  ])('reports a resources.ts with %s as in the way', (_, source) => {
    expect(
      editResources(typescript, PROJECT, PATH, source, generated('orders')),
    ).toEqual({ kind: 'in-the-way', kept: [] });
    expect(
      editResources(null, PROJECT, PATH, source, generated('orders')),
    ).toEqual({
      kind: 'in-the-way',
      kept: [],
    });
  });

  it.each([
    [
      'a tuple type',
      IMPORT + "export const resources: [Resource] = [{ name: 'products' }];\n",
    ],
    [
      'a tuple constraint',
      IMPORT +
        "export const resources = [{ name: 'products' }] satisfies [Resource];\n",
    ],
    [
      'a tuple alias',
      IMPORT +
        "type ResourceTuple = [Resource];\nexport const resources: ResourceTuple = [{ name: 'products' }];\n",
    ],
    [
      'a local Resource type the new table does not fit',
      "interface Resource { name: string; tenant: string }\nexport const resources: Resource[] = [{ name: 'products', tenant: 'shop' }];\n",
    ],
    [
      'a local Array type',
      "type Array<T> = [T];\nexport const resources: Array<{ name: string }> = [{ name: 'products' }];\n",
    ],
  ])(
    'asks for a manual change when the new table does not type-check with %s',
    (_, source) => {
      const result = editResources(
        typescript,
        PROJECT,
        PATH,
        source,
        generated('orders'),
      );

      expect(result.kind).toBe('manual');
      expect(result.kind === 'manual' ? result.reason : '').toMatch(
        /^the array would not type-check with the new tables: /,
      );
    },
  );

  it('comments every line it asks to add and keeps the file below as it was', () => {
    const source = generated('products');
    const wanted = generated('products', 'orders');

    const result = editResources(null, PROJECT, PATH, source, wanted);

    if (result.kind !== 'manual') {
      throw new Error(`expected a manual change, got ${result.kind}`);
    }
    expect(result.reason).toBe('TypeScript is not installed in this app');
    const [block, rest] = [
      result.content.slice(0, result.content.indexOf(source)),
      result.content.slice(result.content.indexOf(source)),
    ];
    expect(rest).toBe(source);
    const lines = block.trimEnd().split('\n');
    expect(lines.every((line) => line.startsWith('// pidrang:'))).toBe(true);
    expect(block).toContain("// pidrang:     name: 'orders',");
    expect(block).toContain("// pidrang:     name: 'products',");
    expect(block).toContain('only the tables that are not in it yet');
    resourceNames(result.content);
  });

  it('reports a list of resource names as in the way without TypeScript', () => {
    expect(
      editResources(
        null,
        PROJECT,
        PATH,
        "import { Resource } from '@pidrang/core';\n\nexport const resources: Resource['name'][] = ['products'];\n",
        generated('orders'),
      ),
    ).toEqual({ kind: 'in-the-way', kept: [] });
  });

  it('changes nothing in a file that already is what the answers give, even without TypeScript', () => {
    const same = generated('products', 'orders');

    expect(editResources(null, PROJECT, PATH, same, same)).toEqual({
      kind: 'unchanged',
      kept: [],
    });
    expect(
      editResources(
        typescript,
        PROJECT,
        PATH,
        same.replace(/\n/g, '\r\n'),
        same,
      ),
    ).toEqual({ kind: 'unchanged', kept: ['products', 'orders'] });
  });

  it('keeps a line separator in a column name inside the comment', () => {
    const wanted = generateResourcesFile({
      providerId: 'fake',
      tables: [
        {
          ...table('orders'),
          fields: [{ name: 'x\u2028throw 1;//', type: 'text' }],
        },
      ],
    });

    const result = editResources(
      null,
      PROJECT,
      PATH,
      generated('products'),
      wanted,
    );

    const content = result.kind === 'manual' ? result.content : '';
    const file = typescript.createSourceFile(
      PATH,
      content,
      typescript.ScriptTarget.Latest,
      true,
    );
    expect(
      file.statements.filter(
        (statement) => !typescript.isImportDeclaration(statement),
      ),
    ).toHaveLength(1);
    expect(content).not.toContain('\u2028');
    expect(content).toContain('x\\u2028throw 1;//');
  });

  it('changes nothing when the same manual change is asked again', () => {
    const wanted = generated('products', 'orders');
    const first = editResources(
      null,
      PROJECT,
      PATH,
      generated('products'),
      wanted,
    );
    const content = first.kind === 'manual' ? first.content : '';

    expect(editResources(null, PROJECT, PATH, content, wanted)).toEqual({
      kind: 'unchanged',
      kept: [],
    });
  });

  it.each([
    [
      'an asset map',
      "export const resources = { logo: '/assets/logo.svg' };\n",
    ],
    ['a function', 'export const resources = () => [];\n'],
    ['an array of strings', "export const resources = ['logo'];\n"],
    ['an inferred array', "export const resources = [{ name: 'products' }];\n"],
    [
      'an array of other objects',
      "export const resources = [{ name: 'logo', fields: 42 }];\n",
    ],
  ])(
    'reports %s exported as resources as in the way when @pidrang/core is not installed',
    (_, source) => {
      expect(
        editResources(typescript, NO_CORE, PATH, source, generated('orders')),
      ).toEqual({ kind: 'in-the-way', kept: [] });
    },
  );

  it('asks for a manual change when resources.ts already has a type error', () => {
    const result = editResources(
      typescript,
      PROJECT,
      PATH,
      "import { Resource } from '@pidrang/core';\nimport { AppResource } from '@app/model';\n\nexport const resources: AppResource[] = [{ name: 'products', tenant: 'shop' }];\n",
      generated('orders'),
    );

    expect(result.kind === 'manual' ? result.reason : result.kind).toBe(
      'resources.ts does not type-check, so pidrang cannot check the new tables against it',
    );
  });

  describe('in an app with @pidrang/core installed', () => {
    let root: string;

    const put = (files: Record<string, string>) => writeFiles(root, files);

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'pidrang-resources-'));
      await put(coreFiles());
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('appends to the file init wrote', () => {
      const result = editResources(
        typescript,
        { root, tsConfig: null },
        PATH,
        generated('products'),
        generated('products', 'orders'),
      );

      expect(result.kind).toBe('edited');
    });

    it('reports an exported resources that is not a list of resources as in the way', () => {
      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          "export const resources = { logo: '/assets/logo.svg' };\n",
          generated('orders'),
        ),
      ).toEqual({ kind: 'in-the-way', kept: [] });
    });

    it('asks for a manual change when the appended table breaks the inferred type pidrang reads', () => {
      const result = editResources(
        typescript,
        { root, tsConfig: null },
        PATH,
        "export const resources = [{ name: 'products' }];\n",
        generated('orders'),
      );

      expect(result.kind).toBe('manual');
    });

    it('type-checks with the declarations the tsconfig includes', async () => {
      await put({
        'tsconfig.json': JSON.stringify({
          compilerOptions: { strict: true, incremental: true },
          include: ['src/**/*.ts'],
        }),
        'src/app-types.d.ts':
          "type AppResource = import('@pidrang/core').Resource & { tenant: string };\n",
      });

      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          IMPORT +
            "export const resources: AppResource[] = [{ name: 'products', tenant: 'shop' }];\n",
          generated('orders'),
        ),
      ).toMatchObject({
        kind: 'manual',
        reason: expect.stringContaining("'tenant'"),
      });
      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          generated('products'),
          generated('products', 'orders'),
        ).kind,
      ).toBe('edited');
    });

    it('reports a read-only list as in the way, since providePidrang takes a mutable one', () => {
      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          IMPORT +
            "export const resources: readonly Resource[] = [{ name: 'products' }];\n",
          generated('orders'),
        ),
      ).toEqual({ kind: 'in-the-way', kept: [] });
    });

    it.each(['null', 'undefined'])(
      'reports resources set to %s as in the way even without strict null checks',
      async (value) => {
        await put({
          'tsconfig.json': JSON.stringify({
            compilerOptions: { strictNullChecks: false },
          }),
        });

        expect(
          editResources(
            typescript,
            { root, tsConfig: null },
            PATH,
            `export const resources = ${value};\n`,
            generated('orders'),
          ),
        ).toEqual({ kind: 'in-the-way', kept: [] });
      },
    );

    it('type-checks even when the app turns checking off', async () => {
      await put({
        'tsconfig.json': JSON.stringify({
          compilerOptions: { strict: true, noCheck: true },
        }),
      });

      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          "export const resources = { logo: '/logo.svg' };\n",
          generated('orders'),
        ),
      ).toEqual({ kind: 'in-the-way', kept: [] });
    });

    it('asks for a manual change when the new table breaks a file that reads resources', async () => {
      await put({
        'tsconfig.json': JSON.stringify({
          compilerOptions: { strict: true },
          include: ['src/**/*.ts'],
        }),
        'src/app/pidrang-resources-probe.ts':
          "import { resources } from './resources';\ndeclare const values: (string | undefined)[];\nexport const existing: string[] = values;\nexport const tenants: string[] = resources.map((resource) => resource.tenant);\n",
      });
      const source =
        IMPORT +
        "export const resources = [{ name: 'products', tenant: 'shop' }] satisfies (Resource & { tenant?: string })[];\n";
      await put({ [PATH]: source });

      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          source,
          generated('orders'),
        ),
      ).toMatchObject({
        kind: 'manual',
        reason: expect.stringContaining('pidrang-resources-probe.ts'),
      });
    });

    it.each([
      `// @ts-nocheck\n${generated('products')}`,
      generated('products').replace(
        "    name: 'products',",
        "    // @ts-ignore\n    name: 'products',",
      ),
      generated('products').replace('\n];', ' // @ts-expect-error\n];'),
    ])(
      'asks for a manual change when resources.ts hides type errors',
      (source) => {
        expect(
          editResources(
            typescript,
            { root, tsConfig: null },
            PATH,
            source,
            generated('products', 'orders'),
          ),
        ).toMatchObject({
          kind: 'manual',
          reason:
            'resources.ts hides type errors with @ts-nocheck, @ts-ignore or @ts-expect-error, so pidrang cannot check the new tables',
        });
      },
    );

    it('asks for a manual change on a suppression after a template string', () => {
      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          `${IMPORT}const label = \`\${1}\`;\n// @ts-ignore\nexport const resources: [Resource] = [{ name: 'products', label }];\n`,
          generated('orders'),
        ).kind,
      ).toBe('manual');
    });

    it('appends to a file whose template only reads like a suppression', () => {
      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          generated('products').replace(
            "label: 'Products'",
            'label: `${1} // @ts-ignore`',
          ),
          generated('products', 'orders'),
        ).kind,
      ).toBe('edited');
    });

    it('appends to a file whose label only reads like a suppression', () => {
      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          generated('products').replace(
            "label: 'Products'",
            "label: '@ts-ignore'",
          ),
          generated('products', 'orders'),
        ).kind,
      ).toBe('edited');
    });

    it('type-checks with the tsconfig of the application', async () => {
      await put({
        'tsconfig.app.json': JSON.stringify({
          extends: './tsconfig.json',
          compilerOptions: { paths: { '@app/model': ['./src/model.ts'] } },
        }),
        'src/model.ts':
          IMPORT +
          'export interface AppResource { name: string; tenant: string }\n',
      });
      const source =
        "import type { AppResource } from '@app/model';\nexport const resources: AppResource[] = [{ name: 'products', tenant: 'shop' }];\n";

      expect(
        editResources(
          typescript,
          { root, tsConfig: null },
          PATH,
          source,
          generated('orders'),
        ),
      ).toMatchObject({
        kind: 'manual',
        reason:
          'resources.ts does not type-check, so pidrang cannot check the new tables against it',
      });
      expect(
        editResources(
          typescript,
          { root, tsConfig: 'tsconfig.app.json' },
          PATH,
          source,
          generated('orders'),
        ),
      ).toMatchObject({
        kind: 'manual',
        reason: expect.stringMatching(/^the array would not type-check/),
      });
    });
  });
});
