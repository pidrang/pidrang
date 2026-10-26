import * as typescript from 'typescript';
import { TablePlan, generateResourcesFile } from '@pidrang/cli';
import { editResources } from './edit-resources';

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
  const result = editResources(typescript, PATH, source, wanted);
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
    const source = `export const resources: Resource[] = [
  { name: 'products' }, // the catalog
];
`;

    const after = edited(source, generated('orders'));

    expect(resourceNames(after)).toEqual(['products', 'orders']);
    expect(after).toContain("{ name: 'products' }, // the catalog");
  });

  it('edits an array declared with a type assertion', () => {
    const after = edited(
      "export const resources = [{ name: 'products' }] as Resource[];\n",
      generated('orders'),
    );

    expect(after).toContain("name: 'orders'");
    expect(after).toContain('] as Resource[];');
  });

  it('fills an empty array', () => {
    const after = edited(
      'export const resources: Resource[] = [];\n',
      generated('orders'),
    );

    expect(resourceNames(after)).toEqual(['orders']);
  });

  it('edits an array written on one line', () => {
    const after = edited(
      "export const resources: Resource[] = [{ name: 'products' }];\n",
      generated('orders'),
    );

    expect(resourceNames(after)).toEqual(['products', 'orders']);
  });

  it.each([
    [
      'a spread element',
      "export const resources: Resource[] = [...shared, { name: 'products' }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'an element held in a variable',
      'export const resources: Resource[] = [products];\n',
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'an object spread that can override the name',
      "const overrides = { name: 'orders' };\nexport const resources: Resource[] = [{ name: 'products', ...overrides }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'a computed key',
      "export const resources: Resource[] = [{ name: 'products', [key]: 'orders' }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'two names in one element',
      "export const resources: Resource[] = [{ name: 'products', name: 'orders' }];\n",
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'a name that is not a string literal',
      'export const resources: Resource[] = [{ name: tableName }];\n',
      'an element of the resources array is not a plain object with a literal name',
    ],
    [
      'an export alias',
      "const active: Resource[] = [{ name: 'products' }];\nexport { active as resources };\n",
      'no `export const resources = [...]` was found',
    ],
    [
      'a resources array that is not exported',
      "const resources: Resource[] = [{ name: 'products' }];\nexport { resources };\n",
      'no `export const resources = [...]` was found',
    ],
    [
      'a let declaration',
      "export let resources: Resource[] = [{ name: 'products' }];\n",
      'no `export const resources = [...]` was found',
    ],
    [
      'a push after the array',
      "export const resources: Resource[] = [{ name: 'products' }];\nresources.push({ name: 'orders', list: false });\n",
      'the resources array is read or changed elsewhere in the file',
    ],
    [
      'a name changed after the array',
      "export const resources: Resource[] = [{ name: 'products' }];\nresources[0].name = 'orders';\n",
      'the resources array is read or changed elsewhere in the file',
    ],
    [
      'an alias of the array',
      "export const resources: Resource[] = [{ name: 'products' }];\nconst all = resources;\nall.push({ name: 'orders' });\n",
      'the resources array is read or changed elsewhere in the file',
    ],
    [
      'a syntax error',
      "export const resources: Resource[] = [\n  { name: 'products' }\n  { name: 'orders' }\n];\n",
      'resources.ts has a syntax error',
    ],
  ])('asks for a manual change with %s', (_, source, reason) => {
    const result = editResources(typescript, PATH, source, generated('orders'));

    expect(result.kind).toBe('manual');
    expect(result.kind === 'manual' ? result.reason : '').toBe(reason);
    expect(result.kept).toEqual([]);
  });

  it('comments every line it asks to add and keeps the file below as it was', () => {
    const source = generated('products');
    const wanted = generated('products', 'orders');

    const result = editResources(null, PATH, source, wanted);

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

  it('changes nothing in a file that already is what the answers give, even without TypeScript', () => {
    const same = generated('products', 'orders');

    expect(editResources(null, PATH, same, same)).toEqual({
      kind: 'unchanged',
      kept: [],
    });
    expect(
      editResources(typescript, PATH, same.replace(/\n/g, '\r\n'), same),
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

    const result = editResources(null, PATH, generated('products'), wanted);

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
    const first = editResources(null, PATH, generated('products'), wanted);
    const content = first.kind === 'manual' ? first.content : '';

    expect(editResources(null, PATH, content, wanted)).toEqual({
      kind: 'unchanged',
      kept: [],
    });
  });
});
