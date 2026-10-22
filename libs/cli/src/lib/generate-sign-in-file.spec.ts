import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generatedSignInPage, templateOf } from './build-sign-in-page';
import { generatePagesBundle } from './generate-pages-bundle';
import { SIGN_IN_PAGE_FILE, generateSignInFile } from './generate-sign-in-file';

const WORKSPACE_ROOT = join(__dirname, '../../../..');
const readDemo = (name: string) =>
  readFileSync(
    join(WORKSPACE_ROOT, 'apps/demo-material/src/app/pages', name),
    'utf8',
  );
const BS = String.fromCharCode(92);
const D = String.fromCharCode(34);

describe('generatedSignInPage', () => {
  const source = readDemo('sign-in-page.ts');
  const page = generatedSignInPage(source);

  it('keeps the demo sign-in form', () => {
    expect(templateOf(source)).toContain('<form (submit)="submit($event)">');
    expect(templateOf(source)).toContain('@if (session.value(); as identity)');
    expect(templateOf(source)).toContain('Sign out');
    expect(templateOf(source)).not.toContain('demo-account');
  });

  it('leaves the demo account out of the template and the class', () => {
    expect(page).not.toContain('demoAccount');
    expect(page).not.toContain('Demo account');
    expect(page).not.toContain('@pidrang/demo-shared');
  });

  it('keeps the sign-out button', () => {
    expect(page).toContain('Sign out');
    expect(page).toContain('async signOut');
  });

  it('imports the page helpers from the barrel it is generated next to', () => {
    expect(page).toContain("import { injectSignIn } from '../pidrang/index';");
    expect(page).not.toContain("from './sign-in'");
  });

  it('inlines the template and the styles', () => {
    expect(page).toContain('const TEMPLATE = "<mat-card>');
    expect(page).toContain('styles: STYLES,');
    expect(page).not.toContain('const TEMPLATE = `');
  });

  it('refuses a source without a template', () => {
    expect(() => generatedSignInPage('export class SignInPage {}\n')).toThrow(
      'The demo sign-in page has no TEMPLATE literal',
    );
  });
});

describe('generateSignInFile', () => {
  it('writes the Material page from the pages bundle', () => {
    const file = generateSignInFile('material');
    const bundled = generatePagesBundle().find(
      (candidate) => candidate.path === SIGN_IN_PAGE_FILE,
    );

    expect(file.path).toBe('src/app/pages/sign-in-page.ts');
    expect(file.content).toBe(bundled?.content);
    expect(file.content).toContain("from '@angular/material/card';");
  });

  it('writes a Tailwind page with the same form and no Material', () => {
    const file = generateSignInFile('tailwind');

    expect(file.path).toBe('src/app/pages/sign-in-page.ts');
    expect(file.content).not.toContain('@angular/material');
    expect(file.content).not.toContain('demoAccount');
    expect(file.content).toContain('Sign out');
    expect(file.content).toContain(
      "import { injectSignIn } from '../pidrang/index';",
    );
    expect(file.content).toContain(`(submit)=${BS}${D}submit($event)${BS}${D}`);
  });

  it('asks for the same credentials in both pages', () => {
    for (const ui of ['material', 'tailwind'] as const) {
      const content = generateSignInFile(ui).content;

      expect(content).toContain('#emailInput');
      expect(content).toContain('#passwordInput');
      expect(content).toContain('this.signInState.signIn({');
      expect(content).toContain('await this.authProvider.logout();');
    }
  });
});
