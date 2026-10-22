import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import * as ts from 'typescript';

import { buildPagesBundle } from './build-pages-bundle';
import {
  generatePagesBundle,
  RESOURCE_ROUTES_SNIPPET,
  SIGN_IN_PATH_SNIPPET,
} from './generate-pages-bundle';

const WORKSPACE_ROOT = join(__dirname, '../../../..');

function commentTexts(content: string): string[] {
  const source = ts.createSourceFile(
    'generated.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const comments = new Map<number, string>();
  const collect = (ranges: ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      comments.set(range.pos, content.slice(range.pos, range.end));
    }
  };
  const visit = (node: ts.Node): void => {
    collect(ts.getLeadingCommentRanges(content, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(content, node.getEnd()));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...comments.values()];
}

function moduleSpecifiers(content: string): string[] {
  const source = ts.createSourceFile(
    'generated.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

describe('moduleSpecifiers', () => {
  it('finds static, re-export, side-effect and dynamic imports in either quote style', () => {
    expect(
      moduleSpecifiers(
        [
          `import { a } from "./a";`,
          `export * from './b';`,
          `import './c';`,
          `const d = () => import('./d');`,
          `const text = "from './not-an-import'";`,
        ].join('\n'),
      ),
    ).toEqual(['./a', './b', './c', './d']);
  });
});

function importsAfterCode(content: string): string[] {
  const source = ts.createSourceFile(
    'file.ts',
    content,
    ts.ScriptTarget.Latest,
  );
  let codeSeen = false;
  const late: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) {
      codeSeen = true;
    } else if (codeSeen) {
      late.push(statement.getText(source));
    }
  }
  return late;
}

describe('importsAfterCode', () => {
  it('finds an import placed after a declaration, not the ones before it', () => {
    expect(
      importsAfterCode(
        "import { a } from './a';\ninterface B { b: number }\nimport { c } from './c';\n",
      ),
    ).toEqual(["import { c } from './c';"]);
  });
});

describe('commentTexts', () => {
  it('finds leading, trailing and block comments', () => {
    expect(
      commentTexts('/* a */\nconst x = 1; // b\nconst y = 2;\n// c\n'),
    ).toEqual(['/* a */', '// b', '// c']);
  });

  it('ignores comment-like text inside strings and templates', () => {
    expect(
      commentTexts(
        "const url = 'http://example.com';\nconst t = `// not /* a */ comment`;\n",
      ),
    ).toEqual([]);
  });
});

describe('generatePagesBundle', () => {
  it('returns the generic pages and the helpers they import', () => {
    const paths = generatePagesBundle().map((file) => file.path);

    expect(paths.filter((path) => path.startsWith('src/app/pages/'))).toEqual([
      'src/app/pages/not-found-page.ts',
      'src/app/pages/resource-list-page.ts',
      'src/app/pages/resource-create-page.ts',
      'src/app/pages/resource-show-page.ts',
      'src/app/pages/resource-edit-page.ts',
      'src/app/pages/sign-in-page.ts',
    ]);
    expect(paths).toContain('src/app/pidrang/index.ts');
    expect(
      paths.every(
        (path) =>
          path.startsWith('src/app/pages/') ||
          path.startsWith('src/app/pidrang/'),
      ),
    ).toBe(true);
  });

  it('never imports from another UI adapter than @pidrang/material', () => {
    const files = generatePagesBundle();

    for (const file of files) {
      expect(file.content).not.toContain('@pidrang/tailwind');
    }
  });

  it('imports ResourceTable/ResourceForm from @pidrang/material where used', () => {
    const files = generatePagesBundle();
    const withMaterialComponent = [
      'src/app/pages/resource-list-page.ts',
      'src/app/pages/resource-create-page.ts',
      'src/app/pages/resource-edit-page.ts',
    ];

    for (const path of withMaterialComponent) {
      const file = files.find((f) => f.path === path);
      expect(file?.content).toContain("from '@pidrang/material'");
    }
  });

  it('generates list/edit pages that filter out hidden fields', () => {
    const files = generatePagesBundle();
    const listState = files.find(
      (file) => file.path === 'src/app/pidrang/resource-list-state.ts',
    );
    const editState = files.find(
      (file) => file.path === 'src/app/pidrang/resource-edit-state.ts',
    );

    expect(listState?.content).toContain('!field.hidden');
    expect(editState?.content).toContain('!field.hidden');
  });

  it('generates a paginated list page with stable id ordering', () => {
    const files = generatePagesBundle();
    const listPage = files.find(
      (file) => file.path === 'src/app/pages/resource-list-page.ts',
    );
    const listState = files.find(
      (file) => file.path === 'src/app/pidrang/resource-list-state.ts',
    );

    expect(listPage?.content).toContain('<mat-paginator');
    expect(listState?.content).toContain(
      'pagination: { current: page(), pageSize: pageSize() }',
    );
    expect(listState?.content).toContain(
      "sorters: definition()?.defaultSorters ?? [{ field: 'id', order: 'asc' }]",
    );
    expect(listPage?.content).not.toContain('list.value()?.data');
  });

  it('guards every resource route with its action flag', () => {
    for (const action of ['create', 'edit', 'show', 'list']) {
      expect(RESOURCE_ROUTES_SNIPPET).toContain(
        `canMatch: [canMatchResourceAction('${action}')]`,
      );
    }
    expect(
      RESOURCE_ROUTES_SNIPPET.indexOf('path: RESOURCE_UNAVAILABLE_PATH'),
    ).toBeLessThan(RESOURCE_ROUTES_SNIPPET.indexOf("':resource'"));
  });

  it('gates generated mutation handlers on their action flag', () => {
    const files = generatePagesBundle();
    const content = (path: string) =>
      files.find((file) => file.path === path)?.content ?? '';

    expect(content('src/app/pidrang/resource-list-state.ts')).toContain(
      'if (!canDelete() ||',
    );
    expect(content('src/app/pidrang/resource-create-state.ts')).toContain(
      'if (!canCreate() || saving())',
    );
    expect(content('src/app/pidrang/resource-edit-state.ts')).toContain(
      'if (!canEdit() || saving())',
    );
  });

  it('never hard-codes a link to /login, a route the app may not have', () => {
    const hardCoded = generatePagesBundle().filter((file) =>
      /\/login\b/.test(file.content),
    );

    expect(hardCoded.map((file) => file.path)).toEqual([]);
  });

  it('exports each page component name once', () => {
    const files = generatePagesBundle();
    const names = [
      'ResourceListPage',
      'ResourceCreatePage',
      'ResourceShowPage',
      'ResourceEditPage',
    ];

    for (const name of names) {
      const matches = files.filter((file) =>
        file.content.includes(`export class ${name}`),
      );
      expect(matches).toHaveLength(1);
    }
  });

  it('emits no comments, any casts or imports below code', () => {
    const contents = [
      ...generatePagesBundle().map((file) => file.content),
      RESOURCE_ROUTES_SNIPPET,
      SIGN_IN_PATH_SNIPPET,
    ];

    for (const content of contents) {
      expect(commentTexts(content)).toEqual([]);
      expect(importsAfterCode(content)).toEqual([]);
      expect(content).not.toContain('<!--');
      expect(content).not.toMatch(/\$any\(|:\s*any\b|\bas any\b/);
    }
  });

  it('generates self-contained files whose relative imports all name a generated file', () => {
    const files = generatePagesBundle();
    const paths = new Set(files.map((file) => file.path));

    for (const file of files) {
      for (const specifier of moduleSpecifiers(file.content)) {
        expect(specifier, `${file.path} imports ${specifier}`).not.toBe(
          '@pidrang/demo-shared',
        );
        if (specifier.startsWith('.')) {
          const resolved = posix.join(posix.dirname(file.path), specifier);
          expect(
            paths.has(`${resolved}.ts`),
            `${file.path} imports ${specifier}`,
          ).toBe(true);
        }
      }
    }
  });

  it('returns a fresh bundle on every call', () => {
    const first = generatePagesBundle();
    first[0].content = 'changed';
    first.pop();

    const second = generatePagesBundle();

    expect(second[0].content).not.toBe('changed');
    expect(second).toHaveLength(first.length + 1);
  });

  it('is in sync with its canonical sources (run pnpm run sync:pages)', () => {
    expect(generatePagesBundle()).toEqual(
      buildPagesBundle((path) =>
        readFileSync(join(WORKSPACE_ROOT, path), 'utf8'),
      ),
    );
  });
});

describe('RESOURCE_ROUTES_SNIPPET', () => {
  it('declares the 4 generic CRUD routes in match-order', () => {
    const createIndex = RESOURCE_ROUTES_SNIPPET.indexOf(":resource/create'");
    const editIndex = RESOURCE_ROUTES_SNIPPET.indexOf(":id/edit'");
    const showIndex = RESOURCE_ROUTES_SNIPPET.indexOf(":resource/:id'");
    const listIndex = RESOURCE_ROUTES_SNIPPET.indexOf(":resource'");

    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeLessThan(editIndex);
    expect(editIndex).toBeLessThan(showIndex);
    expect(showIndex).toBeLessThan(listIndex);
  });

  it('loads every page lazily from a generated file that exports it', () => {
    const files = generatePagesBundle();
    const loaded = [
      ...RESOURCE_ROUTES_SNIPPET.matchAll(
        /import\('(\.\/pages\/[^']+)'\)\.then\(\s*\(page\) => page\.(\w+),?\s*\)/g,
      ),
    ].map(([, specifier, name]) => ({ specifier, name }));

    expect(loaded.map(({ name }) => name)).toEqual([
      'NotFoundPage',
      'SignInPage',
      'ResourceCreatePage',
      'ResourceEditPage',
      'ResourceShowPage',
      'ResourceListPage',
    ]);
    for (const { specifier, name } of loaded) {
      const file = files.find(
        (candidate) =>
          candidate.path === posix.join('src/app', `${specifier}.ts`),
      );
      expect(file?.content, specifier).toContain(`export class ${name}`);
    }
    expect(RESOURCE_ROUTES_SNIPPET).not.toMatch(/^import .*\/pages\//m);
    expect(RESOURCE_ROUTES_SNIPPET).not.toContain('component:');
  });
});

describe('SIGN_IN_PATH_SNIPPET', () => {
  it('imports provideSignInPath from the generated file that defines it', () => {
    const providerFile = generatePagesBundle().find(
      (file) => file.path === 'src/app/pidrang/provide-sign-in-path.ts',
    );

    expect(providerFile?.content).toContain(
      'export function provideSignInPath',
    );
    expect(SIGN_IN_PATH_SNIPPET).toContain(
      "import { provideSignInPath } from './pidrang/provide-sign-in-path';",
    );
    expect(SIGN_IN_PATH_SNIPPET).toContain(
      "provideSignInPath('/your-sign-in-route')",
    );
  });
});
