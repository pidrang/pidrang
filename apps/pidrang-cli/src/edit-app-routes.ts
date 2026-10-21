import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import {
  applyInsertions,
  lineIndent,
  sameLine,
  stripLeadingLines,
} from './text-edit';
import { isWelcome } from './edit-app-html';
import {
  callsTo,
  importInsertions,
  nameConflicts,
  parseSource,
  unwrapExpression,
} from './ts-source';

const SPREAD = '...resourceRoutes';

function declaredInitializer(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): ts.Expression | null {
  const declared = file.statements.flatMap((statement) => {
    if (!typescript.isVariableStatement(statement)) {
      return [];
    }
    return statement.declarationList.declarations.filter(
      (declaration) =>
        typescript.isIdentifier(declaration.name) &&
        declaration.name.text === 'routes' &&
        declaration.initializer !== undefined,
    );
  });
  if (declared.length !== 1) {
    return null;
  }
  return unwrapExpression(typescript, declared[0].initializer as ts.Expression);
}

function routesArray(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): ts.ArrayLiteralExpression | null {
  const initializer = declaredInitializer(typescript, file);
  return initializer !== null && typescript.isArrayLiteralExpression(initializer)
    ? initializer
    : null;
}

const EMPTY_ROUTES = /export\s+const\s+routes\b[^=]*=\s*\[\s*\]/;

export function isEmptyRoutesArray(source: string): boolean {
  return EMPTY_ROUTES.test(source);
}

export function isNewApp(
  typescript: TypeScriptApi | null,
  routesSource: string,
  htmlSource: string | null,
  welcomeTemplate: string | null,
): boolean {
  return (
    htmlSource !== null &&
    !isBareOutlet(htmlSource) &&
    isWelcome(htmlSource, welcomeTemplate) &&
    (typescript === null
      ? isEmptyRoutesArray(normalizeNewlines(routesSource))
      : isEmptyArray(typescript, routesSource))
  );
}

function isEmptyArray(typescript: TypeScriptApi, routesSource: string): boolean {
  const file = parseSource(typescript, 'app.routes.ts', routesSource);
  const routes = routesArray(typescript, file);
  return routes !== null && routes.elements.length === 0;
}

function normalizeNewlines(source: string): string {
  return source.replace(/\r\n/g, '\n');
}

function isBareOutlet(source: string): boolean {
  return normalizeNewlines(source).trim() === '<router-outlet />';
}

function declaresEmptyPath(
  typescript: TypeScriptApi,
  element: ts.Expression,
): boolean {
  if (!typescript.isObjectLiteralExpression(element)) {
    return false;
  }
  return element.properties.some(
    (property) =>
      typescript.isPropertyAssignment(property) &&
      typescript.isIdentifier(property.name) &&
      property.name.text === 'path' &&
      typescript.isStringLiteralLike(property.initializer) &&
      property.initializer.text === '',
  );
}

function quote(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
}

function redirectLine(redirectTo: string): string {
  return `{ path: '', pathMatch: 'full', redirectTo: ${quote(redirectTo)} }`;
}

export function editAppRoutes(
  typescript: TypeScriptApi | null,
  path: string,
  source: string,
  resourceRoutesImport: string,
  redirectTo: string | null = null,
): FileEdit {
  const manualSteps = [
    'pidrang could not edit this file safely. Make these changes by hand, then delete these pidrang lines.',
    'Add this import:',
    `  import { resourceRoutes } from '${resourceRoutesImport}';`,
    'Add ...resourceRoutes at the top of your routes array, above any ** route:',
    '  export const routes: Routes = [...resourceRoutes, ...yourRoutes];',
    ...(redirectTo === null
      ? []
      : [
          'Make the app open a resource page instead of an empty view:',
          `  ${redirectLine(redirectTo)},`,
        ]),
  ];
  const manual = (reason: string): FileEdit => {
    const rest = stripLeadingLines(source, PIDRANG_COMMENT);
    const content = `${commentBlock(PIDRANG_COMMENT, manualSteps)}\n${rest}`;
    return content === source
      ? { kind: 'unchanged' }
      : { kind: 'manual', content, reason };
  };

  if (typescript === null) {
    return manual('TypeScript is not installed in this app');
  }
  const file = parseSource(typescript, path, source);
  if (
    callsTo(typescript, file, 'resourceRoutes').length > 0 ||
    source.includes(SPREAD)
  ) {
    return { kind: 'unchanged' };
  }
  const array = routesArray(typescript, file);
  if (array === null) {
    return manual('no single routes array was found');
  }
  const redirect =
    redirectTo !== null && !array.elements.some((element) =>
      declaresEmptyPath(typescript, element),
    )
      ? redirectLine(redirectTo)
      : null;
  if (
    nameConflicts(
      typescript,
      file,
      [{ name: 'resourceRoutes', from: resourceRoutesImport }],
      [],
    ).length > 0
  ) {
    return manual('the file already uses resourceRoutes for something else');
  }

  const first = array.elements[0];
  const open = array.getStart();
  const indent = first
    ? sameLine(source, open, first.getStart())
      ? `${lineIndent(source, open)}  `
      : lineIndent(source, first.getStart())
    : `${lineIndent(source, open)}  `;
  const close = lineIndent(source, open);
  const lines = [SPREAD, ...(redirect === null ? [] : [redirect])];
  const indented = lines.map((line) => `${indent}${line},`).join('\n');
  const additions =
    first === undefined ? `\n${indented}\n${close}` : `\n${indented}`;
  const imports = importInsertions(typescript, file, [
    { name: 'resourceRoutes', from: resourceRoutesImport },
  ]);
  return {
    kind: 'edited',
    content: applyInsertions(source, [{ at: open + 1, text: additions }, ...imports]),
  };
}
