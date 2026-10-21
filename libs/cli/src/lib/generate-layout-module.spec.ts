import { layoutParts } from './build-layout-module';
import { generatePagesBundle } from './generate-pages-bundle';
import {
  generateLayoutFile,
  layoutAppHtml,
  layoutImport,
} from './generate-layout-module';

const SHARED_IMPORT = "import { injectSignInUrl } from '@pidrang/demo-shared';";
const SIGN_IN_PATH_BARREL = "import { SIGN_IN_PATH } from '../pidrang/index';";
const SIGN_IN_PATH_MODULE = "import { SIGN_IN_PATH } from './sign-in-path';";

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
      SIGN_IN_PATH_BARREL,
    ]);

    expect(imports).toContain(
      "import { Component, input } from '@angular/core';",
    );
    expect(imports).toContain(
      "import { MatButtonModule } from '@angular/material/button';",
    );
    expect(imports.trimEnd().endsWith(SIGN_IN_PATH_BARREL)).toBe(true);
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
      expect(file.content).toContain('injectSignInUrl');
      expect(file.content).toContain(SIGN_IN_PATH_BARREL);
      expect(file.content).not.toContain(SIGN_IN_PATH_MODULE);
      expect(file.content).not.toContain('@pidrang/demo-shared');
      expect(file.content.trimEnd().endsWith('}')).toBe(true);
    },
  );

  it('reads the sign-in path from the page helpers', () => {
    const signInModule = generatePagesBundle().find((file) =>
      file.content.includes("export * from './sign-in-path';"),
    );
    expect(signInModule?.path).toBe('src/app/pidrang/index.ts');
    for (const ui of ['material', 'tailwind'] as const) {
      const content = generateLayoutFile(ui).content;
      expect(content).toContain(SIGN_IN_PATH_BARREL);
      expect(content).toContain('function injectSignInUrl(): UrlTree | null');
      expect(content).toContain('return inject(SIGN_IN_PATH);');
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

  it('renders the layout with the app name and imports it', () => {
    expect(layoutImport()).toBe(
      "import { AppLayout } from './layout/app-layout';\n",
    );
    expect(layoutAppHtml('Shop')).toBe('<app-layout appName="Shop" />\n');
  });
});
