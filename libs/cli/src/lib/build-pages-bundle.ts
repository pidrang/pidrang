import { posix } from 'node:path';

import { GeneratedFile } from './generated-file';
import { PAGES_BUNDLE_SOURCES } from './pages-bundle-sources';

const SHARED_IMPORT = /from '@pidrang\/demo-shared'/g;
const SHARED_DIR = 'src/app/pidrang';

const PROPERTIES = ['template', 'styles'].map((property) => ({
  property,
  name: property.toUpperCase(),
  declaration: new RegExp(
    `^[ \t]*const ${property.toUpperCase()} = \`([\\s\\S]*?)\`;\n`,
    'm',
  ),
  reference: new RegExp(`^[ \t]*${property}: ${property.toUpperCase()},$`, 'm'),
}));

export function inlineTemplateLiterals(content: string): string {
  return PROPERTIES.reduce((current, { property, declaration, reference }) => {
    const found = declaration.exec(current);
    if (found === null) {
      return current;
    }
    return current
      .replace(reference, (line: string) => {
        const indent = /^\n?([ \t]*)/.exec(line)?.[1] ?? '';
        return `${indent}${property}: ${found[1]},`;
      })
      .replace(found[0], '');
  }, content);
}

export function buildPagesBundle(
  readSource: (path: string) => string,
): GeneratedFile[] {
  const files = PAGES_BUNDLE_SOURCES.map(({ target, source, format }) => {
    const content = format ? format(readSource(source)) : readSource(source);
    return {
      path: target,
      content: content.replace(
        SHARED_IMPORT,
        `from '${posix.relative(posix.dirname(target), `${SHARED_DIR}/index`)}'`,
      ),
    };
  });
  const barrel = files
    .filter((file) => posix.dirname(file.path) === SHARED_DIR)
    .map((file) => `export * from './${posix.basename(file.path, '.ts')}';`)
    .join('\n');
  return [...files, { path: `${SHARED_DIR}/index.ts`, content: `${barrel}\n` }];
}
