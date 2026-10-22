import { GeneratedFile } from './generated-file';
import { generatePagesBundle } from './generate-pages-bundle';
import { LayoutUi } from './layout-ui';
import { tailwindSignInPage } from './tailwind-sign-in-page';

export const SIGN_IN_PAGE_FILE = 'src/app/pages/sign-in-page.ts';

export function generateSignInFile(ui: LayoutUi): GeneratedFile {
  const content =
    ui === 'tailwind'
      ? tailwindSignInPage()
      : generatePagesBundle().find((file) => file.path === SIGN_IN_PAGE_FILE)
          ?.content;
  if (content === undefined) {
    throw new Error('The pages bundle has no sign-in page');
  }
  return { path: SIGN_IN_PAGE_FILE, content };
}
