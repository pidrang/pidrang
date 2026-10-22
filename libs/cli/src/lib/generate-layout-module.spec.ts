import { layoutParts } from './build-layout-module';
import { generatePagesBundle } from './generate-pages-bundle';
import { generateLayoutFile, layoutAppHtml } from './generate-layout-module';

const SHARED_IMPORT = "import { injectSignInUrl } from '@pidrang/demo-shared';";
const PAGE_HELPERS_IMPORT =
  "import { injectSignInUrl } from '../pidrang/index';";

const SOURCE = `import { Component, input } from '@angular/core';
import { injectSignInUrl } from '@pidrang/demo-shared';

const TEMPLATE = \`
  <div>
    @if (open()) {
      <router-outlet />
    }
  </div>
\`;

const STYLES = \`
  .menu {
    width: 14rem;
  }
\`;

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterOutlet],
  template: TEMPLATE,
  styles: STYLES,
})
export class AppLayout {
  readonly appName = input.required<string>();
}
`;

describe('layoutParts', () => {
  it('inlines the template and the styles and leaves the imports to the caller', () => {
    const [imports, component] = layoutParts(SOURCE, (given) => [
      given.replace(SHARED_IMPORT, ''),
      "import { MatButtonModule } from '@angular/material/button';",
      PAGE_HELPERS_IMPORT,
    ]);

    expect(imports).toContain(
      "import { Component, input } from '@angular/core';",
    );
    expect(imports).toContain(
      "import { MatButtonModule } from '@angular/material/button';",
    );
    expect(imports.trimEnd().endsWith(PAGE_HELPERS_IMPORT)).toBe(true);
    expect(imports).not.toContain('@pidrang/demo-shared');
    expect(component).toContain('template: "<div>\\n  @if (open()) {');
    expect(component).toContain('styles: ".menu {\\n  width: 14rem;\\n}\\n",');
    expect(component).not.toContain('const TEMPLATE');
    expect(component).not.toContain('const STYLES');
    expect(component.startsWith('@Component({')).toBe(true);
    expect(component.endsWith('}\n')).toBe(true);
  });

  it('refuses a source without the layout component', () => {
    expect(() => layoutParts('const x = 1;\n', (imports) => [imports])).toThrow(
      'The layout source has no AppLayout component',
    );
  });
});

describe('generateLayoutFile', () => {
  it.each(['material', 'tailwind'] as const)(
    'writes a self-contained %s layout',
    (ui) => {
      const file = generateLayoutFile(ui);

      expect(file.path).toBe('src/app/layout/app-layout.ts');
      expect(file.content).toContain("selector: 'app-layout'");
      expect(file.content).toContain(PAGE_HELPERS_IMPORT);
      expect(file.content).not.toContain('InjectionToken');
      expect(file.content).not.toContain('@pidrang/demo-shared');
      expect(file.content.trimEnd().endsWith('}')).toBe(true);
    },
  );

  it('reads the sign-in link from the page helpers barrel', () => {
    const barrel = generatePagesBundle().find(
      (file) => file.path === 'src/app/pidrang/index.ts',
    );
    expect(barrel?.content).toContain("export * from './sign-in-url';");
    for (const ui of ['material', 'tailwind'] as const) {
      const content = generateLayoutFile(ui).content;
      expect(
        content.match(/^import .* from '\.\.\/pidrang\/index';$/gm),
      ).toEqual([PAGE_HELPERS_IMPORT]);
      expect(content).toContain('injectSignInUrl();');
    }
  });

  it('uses Angular Material in the Material layout and none in the Tailwind one', () => {
    const material = generateLayoutFile('material').content;
    const tailwind = generateLayoutFile('tailwind').content;

    expect(material).toContain("from '@angular/material/toolbar';");
    expect(material).toContain('<mat-toolbar>');
    expect(tailwind).not.toContain('@angular/material');
    expect(tailwind).toContain('flex min-h-svh');
  });

  it('renders the layout with the app name', () => {
    expect(layoutAppHtml('Shop')).toBe('<app-layout appName="Shop" />\n');
  });
});
