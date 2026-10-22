const MODULE_END = /^export class SignInPage \{\n[\s\S]*?^\}\n/m;
const TEMPLATE_LITERAL = /^const TEMPLATE = `([\s\S]*?)`;\n/m;
const TEMPLATE_LINE = /^ {2}template: \w+,$/m;
const DEMO_ACCOUNT_IMPORT =
  /^import \{ DEMO_ACCOUNT, DemoAccount \} from '@pidrang\/demo-shared';\n/m;
const DEMO_ACCOUNT_FIELD =
  /^ {2}protected readonly demoAccount = inject\(DEMO_ACCOUNT\);\n/m;
const SIGN_IN_AS_DEMO =
  /^ {2}protected async signInAsDemo\([^)]*\)[\s\S]*?^ {2}\}\n/m;
const HELPERS_IMPORT = /^import \{ injectSignIn \} from '\.\/sign-in';\n/m;

export const SIGN_IN_PAGE_HELPERS_IMPORT =
  "import { injectSignIn } from '../pidrang/index';";

function dedent(block: string): string {
  const lines = block
    .replace(/^\n/, '')
    .replace(/\n\s*$/, '')
    .split('\n');
  const printed = lines.filter((line) => line.trim() !== '');
  const indent = Math.min(...printed.map((line) => line.search(/\S/)));
  return `${lines.map((line) => line.slice(indent)).join('\n')}\n`;
}

function withoutDemoAccount(template: string): string {
  const start = template.indexOf('\n\n    @if (demoAccount');
  const end = template.lastIndexOf('\n  </mat-card-content>');
  if (start === -1 || end === -1) {
    throw new Error('The demo sign-in page has no demo-account section');
  }
  return template.slice(0, start + 1) + template.slice(end + 1);
}

export function templateOf(source: string): string {
  const template = TEMPLATE_LITERAL.exec(source);
  if (template === null) {
    throw new Error('The demo sign-in page has no TEMPLATE literal');
  }
  return withoutDemoAccount(dedent(template[1]));
}

function imports(source: string): string {
  const template = TEMPLATE_LITERAL.exec(source);
  if (template === null) {
    throw new Error('The demo sign-in page has no TEMPLATE literal');
  }
  return source
    .slice(0, template.index)
    .replace(DEMO_ACCOUNT_IMPORT, '')
    .replace(HELPERS_IMPORT, () => SIGN_IN_PAGE_HELPERS_IMPORT)
    .trimEnd();
}

function body(source: string): string {
  const start = source.indexOf('@Component({');
  const end = MODULE_END.exec(source);
  if (start === -1 || end === null) {
    throw new Error('The demo sign-in page has no SignInPage component');
  }
  const component = source
    .slice(start, end.index + end[0].length)
    .replace(TEMPLATE_LINE, () => '  template: TEMPLATE,')
    .replace(DEMO_ACCOUNT_FIELD, '')
    .replace(SIGN_IN_AS_DEMO, '\n');
  return `${component.replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export function generatedSignInPage(source: string): string {
  const literal = `const TEMPLATE = ${JSON.stringify(templateOf(source))};\n`;
  return `${imports(source)}\n\n${literal}\n${body(source)}`;
}
