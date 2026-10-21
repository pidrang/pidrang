const MODULE_START = /^@Component\(\{/m;
const MODULE_END = /^export class AppLayout \{\n[\s\S]*?^\}\n/m;
const TEMPLATE_LITERAL = /const TEMPLATE = `([\s\S]*?)`;\n/;
const STYLES_LITERAL = /const STYLES = `([\s\S]*?)`;\n/;
const TEMPLATE_LINE = /^ {2}template: \w+,$/m;
const STYLES_LINE = /^ {2}styles: \w+,$/m;

function dedent(block: string): string {
  const lines = block
    .replace(/^\n/, '')
    .replace(/\n\s*$/, '')
    .split('\n');
  const printed = lines.filter((line) => line.trim() !== '');
  const indent = Math.min(...printed.map((line) => line.search(/\S/)));
  return `${lines.map((line) => line.slice(indent)).join('\n')}\n`;
}

function literal(source: string, pattern: RegExp, name: string): string {
  const match = pattern.exec(source);
  if (match === null) {
    throw new Error(`The layout source has no ${name} block`);
  }
  return JSON.stringify(dedent(match[1]));
}

function moduleParts(source: string): {
  imports: string;
  template: string;
  styles: string | null;
  module: string;
} {
  const start = source.search(MODULE_START);
  const end = MODULE_END.exec(source);
  if (start < 0 || end === null) {
    throw new Error('The layout source has no AppLayout component');
  }
  const header = source.slice(0, start).replace(TEMPLATE_LITERAL, '');
  const styleBlock = source.match(STYLES_LITERAL);
  return {
    imports: (styleBlock === null
      ? header
      : header.replace(styleBlock[0], '')
    ).trimEnd(),
    template: literal(source, TEMPLATE_LITERAL, 'TEMPLATE'),
    styles: styleBlock === null ? null : JSON.stringify(dedent(styleBlock[1])),
    module: source.slice(start, end.index + end[0].length),
  };
}

export function layoutParts(
  source: string,
  replaceImports: (imports: string) => string[],
): string[] {
  const { imports, template, styles, module } = moduleParts(source);
  const inlined = module.replace(TEMPLATE_LINE, `  template: ${template},`);
  const withStyles =
    styles === null
      ? inlined
      : inlined.replace(STYLES_LINE, `  styles: ${styles},`);
  const header = replaceImports(imports)
    .filter((group) => group.trim() !== '')
    .join('\n\n')
    .trimEnd();
  return [`${header}\n`, withStyles];
}
