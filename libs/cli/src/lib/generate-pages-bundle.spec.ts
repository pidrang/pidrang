import {
  generatePagesBundle,
  RESOURCE_ROUTES_SNIPPET,
} from './generate-pages-bundle';

describe('generatePagesBundle', () => {
  it('returns the 9 generic files at their expected paths', () => {
    const files = generatePagesBundle();

    expect(files.map((file) => file.path)).toEqual([
      'src/app/auth-required-error.ts',
      'src/app/record-label.ts',
      'src/app/can-match-resource-action.ts',
      'src/app/resource-unavailable-path.ts',
      'src/app/pages/not-found-page.ts',
      'src/app/pages/resource-list-page.ts',
      'src/app/pages/resource-create-page.ts',
      'src/app/pages/resource-show-page.ts',
      'src/app/pages/resource-edit-page.ts',
    ]);
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
    const listPage = files.find(
      (file) => file.path === 'src/app/pages/resource-list-page.ts',
    );
    const editPage = files.find(
      (file) => file.path === 'src/app/pages/resource-edit-page.ts',
    );

    expect(listPage?.content).toContain('!field.hidden');
    expect(editPage?.content).toContain('!field.hidden');
  });

  it('generates a paginated list page with stable id ordering', () => {
    const listPage = generatePagesBundle().find(
      (file) => file.path === 'src/app/pages/resource-list-page.ts',
    );

    expect(listPage?.content).toContain('<mat-paginator');
    expect(listPage?.content).toContain(
      'pagination: { current: this.page(), pageSize: this.pageSize() }',
    );
    expect(listPage?.content).toContain(
      "sorters: [{ field: 'id', order: 'asc' }]",
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

    expect(content('src/app/pages/resource-list-page.ts')).toContain(
      'if (!this.canDelete())',
    );
    expect(content('src/app/pages/resource-create-page.ts')).toContain(
      'if (!this.canCreate())',
    );
    expect(content('src/app/pages/resource-edit-page.ts')).toContain(
      'if (!this.canEdit())',
    );
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
});
