import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import {
  TextInsertion,
  applyInsertions,
  lineIndent,
  sameLine,
  stripLeadingLines,
} from './text-edit';
import {
  callsTo,
  importInsertions,
  nameConflicts,
  parseSource,
  unwrapExpression,
} from './ts-source';

const SPREAD = '...resourceRoutes';

function routesArray(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): ts.ArrayLiteralExpression | null {
  const declared = file.statements.flatMap((statement) => {
    if (!typescript.isVariableStatement(statement)) {
      return [];
    }
    return statement.declarationList.declarations.filter(
      (declaration) =>
        typescript.isIdentifier(declaration.name) &&
        declaration.name.text === 'routes' &&
        declaration.initializer !== undefined &&
        typescript.isArrayLiteralExpression(
          unwrapExpression(typescript, declaration.initializer),
        ),
    );
  });
  if (declared.length !== 1) {
    return null;
  }
  return unwrapExpression(
    typescript,
    declared[0].initializer as ts.Expression,
  ) as ts.ArrayLiteralExpression;
}

export function editAppRoutes(
  typescript: TypeScriptApi | null,
  path: string,
  source: string,
  resourceRoutesImport: string,
): FileEdit {
  const manualSteps = [
    'pidrang could not edit this file safely. Make these changes by hand, then delete these pidrang lines.',
    'Add this import:',
    `  import { resourceRoutes } from '${resourceRoutesImport}';`,
    'Add ...resourceRoutes at the top of your routes array, above any ** route:',
    '  export const routes: Routes = [...resourceRoutes, ...yourRoutes];',
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
  const spread = first
    ? `\n${indent}${SPREAD},`
    : `\n${indent}${SPREAD},\n${lineIndent(source, open)}`;
  const insertions: TextInsertion[] = [
    { at: open + 1, text: spread },
    ...importInsertions(typescript, file, [
      { name: 'resourceRoutes', from: resourceRoutesImport },
    ]),
  ];
  return { kind: 'edited', content: applyInsertions(source, insertions) };
}
