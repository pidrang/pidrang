import type * as ts from 'typescript';
import { SetupImport } from '@pidrang/cli';
import { TypeScriptApi } from './app-tooling';
import { TextInsertion } from './text-edit';

export function parseSource(
  typescript: TypeScriptApi,
  path: string,
  source: string,
): ts.SourceFile {
  return typescript.createSourceFile(
    path,
    source,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS,
  );
}

function importsOf(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): ts.ImportDeclaration[] {
  return file.statements.filter(typescript.isImportDeclaration);
}

function moduleOf(
  typescript: TypeScriptApi,
  declaration: ts.ImportDeclaration,
): string | null {
  return typescript.isStringLiteral(declaration.moduleSpecifier)
    ? declaration.moduleSpecifier.text
    : null;
}

export function importedFrom(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const declaration of importsOf(typescript, file)) {
    const from = moduleOf(typescript, declaration) ?? '';
    const clause = declaration.importClause;
    if (clause?.name) {
      names.set(clause.name.text, `${from}#default`);
    }
    const bindings = clause?.namedBindings;
    if (bindings && typescript.isNamespaceImport(bindings)) {
      names.set(bindings.name.text, `${from}#*`);
    } else if (bindings) {
      for (const element of bindings.elements) {
        const imported = element.propertyName?.text ?? element.name.text;
        names.set(
          element.name.text,
          imported === element.name.text ? from : `${from}#${imported}`,
        );
      }
    }
  }
  return names;
}

export function declaredNames(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): Set<string> {
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (typescript.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(typescript, declaration.name, names);
      }
    } else if (
      (typescript.isFunctionDeclaration(statement) ||
        typescript.isClassDeclaration(statement) ||
        typescript.isEnumDeclaration(statement) ||
        typescript.isInterfaceDeclaration(statement) ||
        typescript.isTypeAliasDeclaration(statement) ||
        typescript.isModuleDeclaration(statement)) &&
      statement.name &&
      typescript.isIdentifier(statement.name)
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}

function collectBindingNames(
  typescript: TypeScriptApi,
  name: ts.BindingName,
  names: Set<string>,
): void {
  if (typescript.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (!typescript.isOmittedExpression(element)) {
      collectBindingNames(typescript, element.name, names);
    }
  }
}

export function findAll<T extends ts.Node>(
  root: ts.Node,
  guard: (node: ts.Node) => node is T,
): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (guard(node)) {
      found.push(node);
    }
    node.forEachChild(visit);
  };
  visit(root);
  return found;
}

export function callsTo(
  typescript: TypeScriptApi,
  root: ts.Node,
  name: string,
): ts.CallExpression[] {
  return findAll(root, typescript.isCallExpression).filter(
    (call) =>
      typescript.isIdentifier(call.expression) && call.expression.text === name,
  );
}

export function unwrapExpression(
  typescript: TypeScriptApi,
  expression: ts.Expression,
): ts.Expression {
  let current = expression;
  while (
    typescript.isAsExpression(current) ||
    typescript.isSatisfiesExpression(current) ||
    typescript.isParenthesizedExpression(current) ||
    typescript.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

export function nameConflicts(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
  imports: SetupImport[],
  locals: string[],
): string[] {
  const imported = importedFrom(typescript, file);
  const declared = declaredNames(typescript, file);
  const importConflicts = imports
    .filter(
      (entry) =>
        declared.has(entry.name) ||
        (imported.has(entry.name) && imported.get(entry.name) !== entry.from),
    )
    .map((entry) => entry.name);
  const localConflicts = locals.filter(
    (name) => declared.has(name) || imported.has(name),
  );
  return [...importConflicts, ...localConflicts];
}

export function isRelative(from: string): boolean {
  return from.startsWith('.');
}

export function importInsertions(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
  imports: SetupImport[],
): TextInsertion[] {
  const imported = importedFrom(typescript, file);
  const missing = imports.filter(
    (entry) => imported.get(entry.name) !== entry.from,
  );
  const declarations = importsOf(typescript, file);
  const insertions: TextInsertion[] = [];
  const newModules: string[] = [];
  const namesByModule = new Map<string, string[]>();
  for (const entry of missing) {
    if (!namesByModule.has(entry.from)) {
      namesByModule.set(entry.from, []);
      newModules.push(entry.from);
    }
    const names = namesByModule.get(entry.from) ?? [];
    if (!names.includes(entry.name)) {
      names.push(entry.name);
    }
  }
  const lines = { package: [] as string[], relative: [] as string[] };
  for (const from of newModules) {
    const names = namesByModule.get(from) ?? [];
    const target = declarations.find((declaration) => {
      const bindings = declaration.importClause?.namedBindings;
      return (
        moduleOf(typescript, declaration) === from &&
        !declaration.importClause?.isTypeOnly &&
        bindings !== undefined &&
        typescript.isNamedImports(bindings)
      );
    });
    const bindings = target?.importClause?.namedBindings;
    if (bindings && typescript.isNamedImports(bindings)) {
      const elements = bindings.elements;
      if (elements.length === 0) {
        insertions.push({
          at: bindings.getStart() + 1,
          text: ` ${names.join(', ')} `,
        });
      } else {
        insertions.push({
          at: elements[elements.length - 1].end,
          text: elements.hasTrailingComma
            ? ` ${names.join(', ')},`
            : `, ${names.join(', ')}`,
        });
      }
      continue;
    }
    const line = `import { ${names.join(', ')} } from '${from}';`;
    (isRelative(from) ? lines.relative : lines.package).push(line);
  }
  const lastImport = declarations.at(-1);
  const lastPackageImport = declarations
    .filter(
      (declaration) => !isRelative(moduleOf(typescript, declaration) ?? ''),
    )
    .at(-1);
  if (lines.package.length > 0) {
    const anchor = lastPackageImport ?? lastImport;
    insertions.push(
      anchor
        ? { at: anchor.end, text: `\n${lines.package.join('\n')}` }
        : { at: 0, text: `${lines.package.join('\n')}\n` },
    );
  }
  if (lines.relative.length > 0) {
    insertions.push(
      lastImport
        ? { at: lastImport.end, text: `\n${lines.relative.join('\n')}` }
        : { at: 0, text: `${lines.relative.join('\n')}\n` },
    );
  }
  return insertions;
}

export function lastImportEnd(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): number | null {
  return importsOf(typescript, file).at(-1)?.end ?? null;
}
