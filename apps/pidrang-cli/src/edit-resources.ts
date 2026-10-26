import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import { applyInsertions, lineIndent, stripLeadingLines } from './text-edit';
import { findAll, parseSource, unwrapExpression } from './ts-source';
import { typeCheckResources } from './type-check-resources';

type ResourcesEdit = (FileEdit | { kind: 'in-the-way' }) & { kept: string[] };

export interface ResourcesProject {
  root: string;
  tsConfig: string | null;
}

const NOT_EXPORTED = 'no `export const resources = [...]` was found';
const USED_ELSEWHERE =
  'the resources array is read or changed elsewhere in the file';
const UNCHECKED =
  'resources.ts hides type errors with @ts-nocheck, @ts-ignore or @ts-expect-error, so pidrang cannot check the new tables';
const SUPPRESSION = /@ts-(?:nocheck|ignore|expect-error)\b/;
const RETYPED =
  'adding the tables would change the type of resources, which code that reads it may not expect';
const UNTYPED =
  'resources.ts does not type-check, so pidrang cannot check the new tables against it';
const ASSERTED =
  'the resources array has a type assertion, which would not check the new tables';
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

function asserted(
  typescript: TypeScriptApi,
  array: ts.ArrayLiteralExpression,
): boolean {
  let node: ts.Node = array.parent;
  while (
    typescript.isAsExpression(node) ||
    typescript.isTypeAssertionExpression(node) ||
    typescript.isSatisfiesExpression(node) ||
    typescript.isParenthesizedExpression(node)
  ) {
    if (
      typescript.isTypeAssertionExpression(node) ||
      (typescript.isAsExpression(node) &&
        !(
          typescript.isTypeReferenceNode(node.type) &&
          typescript.isIdentifier(node.type.typeName) &&
          node.type.typeName.text === 'const'
        ))
    ) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function suppressesErrors(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): boolean {
  const source = file.getFullText();
  const visit = (node: ts.Node): boolean =>
    [
      ...(typescript.getLeadingCommentRanges(source, node.pos) ?? []),
      ...(typescript.getTrailingCommentRanges(source, node.end) ?? []),
    ].some((range) => SUPPRESSION.test(source.slice(range.pos, range.end))) ||
    node.getChildren(file).some(visit);
  return visit(file);
}

function boundNames(typescript: TypeScriptApi, name: ts.BindingName): string[] {
  if (typescript.isIdentifier(name)) {
    return [name.text];
  }
  return name.elements.flatMap((element) =>
    typescript.isOmittedExpression(element)
      ? []
      : boundNames(typescript, element.name),
  );
}

function hasModifier(
  statement: ts.VariableStatement,
  kind: ts.SyntaxKind,
): boolean {
  return (statement.modifiers ?? []).some((modifier) => modifier.kind === kind);
}

function exportsResources(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): boolean {
  const variables = file.statements.filter(
    (statement): statement is ts.VariableStatement =>
      typescript.isVariableStatement(statement) &&
      !hasModifier(statement, typescript.SyntaxKind.DeclareKeyword),
  );
  const names = (statements: ts.VariableStatement[]) =>
    statements.flatMap((statement) =>
      statement.declarationList.declarations.flatMap((declaration) =>
        boundNames(typescript, declaration.name),
      ),
    );
  const locals = names(variables);
  const aliased = file.statements.some(
    (statement) =>
      typescript.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      typescript.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some(
        (element) =>
          !element.isTypeOnly &&
          element.name.text === 'resources' &&
          locals.includes((element.propertyName ?? element.name).text),
      ),
  );
  return (
    aliased ||
    names(
      variables.filter((statement) =>
        hasModifier(statement, typescript.SyntaxKind.ExportKeyword),
      ),
    ).includes('resources')
  );
}

function startsAsGenerated(source: string, generated: string): boolean {
  return stripLeadingLines(source, PIDRANG_COMMENT).startsWith(
    generated.slice(0, generated.indexOf('= [') + '= ['.length),
  );
}

function isPropertyName(
  typescript: TypeScriptApi,
  identifier: ts.Identifier,
): boolean {
  const parent = identifier.parent;
  return (
    (typescript.isPropertyAccessExpression(parent) ||
      typescript.isPropertyAssignment(parent)) &&
    parent.name === identifier
  );
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
      !isPropertyName(typescript, identifier) &&
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
    (property, index): property is ts.PropertyAssignment =>
      names[index] === 'name' && typescript.isPropertyAssignment(property),
  );
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

function afterComments(
  typescript: TypeScriptApi,
  source: string,
  position: number,
): number {
  return (
    typescript.getTrailingCommentRanges(source, position)?.at(-1)?.end ??
    position
  );
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
  project: ResourcesProject,
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
    return startsAsGenerated(source, generated)
      ? manual(source, generated, 'TypeScript is not installed in this app')
      : { kind: 'in-the-way', kept: [] };
  }
  const file = parseSource(typescript, path, source);
  if (!exportsResources(typescript, file)) {
    return { kind: 'in-the-way', kept: [] };
  }
  if (hasSyntaxError(typescript, source)) {
    return manual(source, generated, 'resources.ts has a syntax error');
  }
  const check = (content: string) =>
    typeCheckResources(
      typescript,
      project.root,
      project.tsConfig,
      path,
      content,
    );
  const before = check(source);
  const array = exportedResources(typescript, file);
  if (
    before.fitsPidrang === false ||
    (before.fitsPidrang === null && !startsAsGenerated(source, generated))
  ) {
    return { kind: 'in-the-way', kept: [] };
  }
  if (array === null) {
    return manual(source, generated, NOT_EXPORTED);
  }
  if (asserted(typescript, array)) {
    return manual(source, generated, ASSERTED);
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
  if (suppressesErrors(typescript, file)) {
    return manual(source, generated, UNCHECKED);
  }
  if (!before.typed) {
    return manual(source, generated, UNTYPED);
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
              at: afterComments(typescript, source, elements.end),
              text: `\n${blocks.map((block) => `${block},`).join('\n')}`,
            },
          ]
        : [
            { at: last.end, text: ',' },
            {
              at: afterComments(typescript, source, last.end),
              text: `\n${blocks.join(',\n')}`,
            },
          ];
  const content = applyInsertions(source, insertions);
  if (hasSyntaxError(typescript, content)) {
    throw new Error(`pidrang produced an invalid ${path}.`);
  }
  const after = check(content);
  const baseline = [...before.errors];
  const [error] = after.errors.filter((message) => {
    const index = baseline.indexOf(message);
    if (index >= 0) {
      baseline.splice(index, 1);
    }
    return index < 0;
  });
  if (error !== undefined) {
    return manual(
      source,
      generated,
      `the array would not type-check with the new tables: ${error}`,
    );
  }
  if (after.exportedType !== before.exportedType) {
    return manual(source, generated, RETYPED);
  }
  return { kind: 'edited', content, kept };
}
