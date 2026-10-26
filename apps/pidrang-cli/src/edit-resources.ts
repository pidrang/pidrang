import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import { applyInsertions, lineIndent, stripLeadingLines } from './text-edit';
import { findAll, parseSource, unwrapExpression } from './ts-source';

type ResourcesEdit = FileEdit & { kept: string[] };

const NOT_EXPORTED = 'no `export const resources = [...]` was found';
const USED_ELSEWHERE =
  'the resources array is read or changed elsewhere in the file';
const UNKNOWN_ELEMENT =
  'an element of the resources array is not a plain object with a literal name';

function exportedResources(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): ts.ArrayLiteralExpression | null {
  const declarations = file.statements.flatMap((statement) => {
    if (!typescript.isVariableStatement(statement)) {
      return [];
    }
    return statement.declarationList.declarations
      .filter(
        (declaration) =>
          typescript.isIdentifier(declaration.name) &&
          declaration.name.text === 'resources',
      )
      .map((declaration) => ({ statement, declaration }));
  });
  if (declarations.length !== 1) {
    return null;
  }
  const [{ statement, declaration }] = declarations;
  const exported = statement.modifiers?.some(
    (modifier) => modifier.kind === typescript.SyntaxKind.ExportKeyword,
  );
  const constant =
    (statement.declarationList.flags & typescript.NodeFlags.Const) !== 0;
  if (
    !exported ||
    !constant ||
    statement.declarationList.declarations.length !== 1 ||
    declaration.initializer === undefined
  ) {
    return null;
  }
  const initializer = unwrapExpression(typescript, declaration.initializer);
  return typescript.isArrayLiteralExpression(initializer) ? initializer : null;
}

function usedElsewhere(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
  array: ts.ArrayLiteralExpression,
): boolean {
  let declaration: ts.Node = array;
  while (!typescript.isVariableDeclaration(declaration)) {
    declaration = declaration.parent;
  }
  return findAll(file, typescript.isIdentifier).some(
    (identifier) =>
      identifier.text === 'resources' &&
      !(
        typescript.isVariableDeclaration(identifier.parent) &&
        identifier.parent.name === identifier &&
        identifier.parent === declaration
      ),
  );
}

function propertyName(
  typescript: TypeScriptApi,
  property: ts.ObjectLiteralElementLike,
): string | null {
  if (typescript.isShorthandPropertyAssignment(property)) {
    return property.name.text;
  }
  if (!typescript.isPropertyAssignment(property)) {
    return null;
  }
  return typescript.isIdentifier(property.name) ||
    typescript.isStringLiteral(property.name)
    ? property.name.text
    : null;
}

function resourceName(
  typescript: TypeScriptApi,
  element: ts.Expression,
): string | null {
  if (!typescript.isObjectLiteralExpression(element)) {
    return null;
  }
  const names = element.properties.map((property) =>
    propertyName(typescript, property),
  );
  if (names.includes(null)) {
    return null;
  }
  const named = element.properties.filter(
    (property, index) =>
      names[index] === 'name' && typescript.isPropertyAssignment(property),
  ) as ts.PropertyAssignment[];
  if (
    named.length !== 1 ||
    names.filter((name) => name === 'name').length !== 1 ||
    !typescript.isStringLiteral(named[0].initializer)
  ) {
    return null;
  }
  return named[0].initializer.text;
}

function hasSyntaxError(typescript: TypeScriptApi, source: string): boolean {
  const { diagnostics } = typescript.transpileModule(source, {
    reportDiagnostics: true,
  });
  return (diagnostics ?? []).length > 0;
}

function generatedLiterals(
  typescript: TypeScriptApi,
  path: string,
  generated: string,
): { name: string; text: string }[] {
  const file = parseSource(typescript, path, generated);
  const array = exportedResources(typescript, file);
  if (array === null) {
    throw new Error('The generated resources.ts has no resources array.');
  }
  return array.elements.map((element) => {
    const name = resourceName(typescript, element);
    if (name === null) {
      throw new Error('The generated resources.ts has an unnamed resource.');
    }
    return { name, text: element.getText(file) };
  });
}

function endOfLine(source: string, position: number): number {
  const lineEnd = source.indexOf('\n', position);
  return lineEnd >= 0 && /^\s*(\/\/.*)?$/.test(source.slice(position, lineEnd))
    ? lineEnd
    : position;
}

function generatedLiteralLines(generated: string): string[] {
  const start = generated.indexOf('[\n') + 2;
  const end = generated.lastIndexOf('\n];');
  return generated
    .slice(start, end)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .split('\n');
}

function manual(
  source: string,
  generated: string,
  reason: string,
): ResourcesEdit {
  const steps = [
    'pidrang could not edit this file safely. Make these changes by hand, then delete these pidrang lines.',
    'Add to the resources array only the tables that are not in it yet:',
    ...generatedLiteralLines(generated),
  ];
  const rest = stripLeadingLines(source, PIDRANG_COMMENT);
  const content = `${commentBlock(PIDRANG_COMMENT, steps)}\n${rest}`;
  return content === source
    ? { kind: 'unchanged', kept: [] }
    : { kind: 'manual', content, reason, kept: [] };
}

export function editResources(
  typescript: TypeScriptApi | null,
  path: string,
  raw: string,
  generated: string,
): ResourcesEdit {
  const source = raw.replace(/\r\n/g, '\n');
  if (source === generated) {
    return {
      kind: 'unchanged',
      kept:
        typescript === null
          ? []
          : generatedLiterals(typescript, path, generated).map(
              (literal) => literal.name,
            ),
    };
  }
  if (typescript === null) {
    return manual(source, generated, 'TypeScript is not installed in this app');
  }
  if (hasSyntaxError(typescript, source)) {
    return manual(source, generated, 'resources.ts has a syntax error');
  }
  const file = parseSource(typescript, path, source);
  const array = exportedResources(typescript, file);
  if (array === null) {
    return manual(source, generated, NOT_EXPORTED);
  }
  if (usedElsewhere(typescript, file, array)) {
    return manual(source, generated, USED_ELSEWHERE);
  }
  const existing = array.elements.map((element) =>
    resourceName(typescript, element),
  );
  if (existing.includes(null)) {
    return manual(source, generated, UNKNOWN_ELEMENT);
  }
  const wanted = generatedLiterals(typescript, path, generated);
  const kept = wanted
    .filter((literal) => existing.includes(literal.name))
    .map((literal) => literal.name);
  const added = wanted.filter((literal) => !existing.includes(literal.name));
  if (added.length === 0) {
    return { kind: 'unchanged', kept };
  }

  const elements = array.elements;
  const last = elements.at(-1);
  const indent =
    last === undefined
      ? `${lineIndent(source, array.getStart(file))}  `
      : lineIndent(source, last.getStart(file));
  const blocks = added.map((literal) =>
    literal.text
      .split('\n')
      .map((line, index) =>
        index === 0 ? `${indent}${line}` : `${indent}${line.slice(2)}`,
      )
      .join('\n'),
  );
  const insertions =
    last === undefined
      ? [
          {
            at: array.getStart(file) + 1,
            text: `\n${blocks.map((block) => `${block},`).join('\n')}\n`,
          },
        ]
      : elements.hasTrailingComma
        ? [
            {
              at: endOfLine(source, elements.end),
              text: `\n${blocks.map((block) => `${block},`).join('\n')}`,
            },
          ]
        : [
            { at: last.end, text: ',' },
            {
              at: endOfLine(source, last.end),
              text: `\n${blocks.join(',\n')}`,
            },
          ];
  const content = applyInsertions(source, insertions);
  if (hasSyntaxError(typescript, content)) {
    throw new Error(`pidrang produced an invalid ${path}.`);
  }
  return { kind: 'edited', content, kept };
}
