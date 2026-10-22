import type * as ts from 'typescript';
import { SetupImport } from '@pidrang/cli';
import { TypeScriptApi } from './app-tooling';
import {
  FileEdit,
  PIDRANG_COMMENT,
  appendElement,
  commentBlock,
} from './edit-app-config';
import { lineIndent, sameLine, stripLeadingLines } from './text-edit';
import {
  callsTo,
  findAll,
  importInsertions,
  nameConflicts,
  parseSource,
  unwrapExpression,
} from './ts-source';

export const LAYOUT_COMPONENT: SetupImport = {
  name: 'AppLayout',
  from: './layout/app-layout',
};

const ROUTER_OUTLET = 'RouterOutlet';

export interface TextChange {
  from: number;
  to: number;
  text: string;
}

export function applyChanges(source: string, changes: TextChange[]): string {
  return changes
    .map((change, order) => ({ ...change, order }))
    .sort((a, b) => b.from - a.from || b.order - a.order)
    .reduce(
      (text, change) =>
        text.slice(0, change.from) + change.text + text.slice(change.to),
      source,
    );
}

function manual(source: string, reason: string): FileEdit {
  const rest = stripLeadingLines(source, PIDRANG_COMMENT);
  const steps = [
    'pidrang could not edit this file safely. Make these changes by hand, then delete these pidrang lines.',
    'pidrang replaced app.html with the navigation layout. Import it:',
    `  import { ${LAYOUT_COMPONENT.name} } from '${LAYOUT_COMPONENT.from}';`,
    `Add ${LAYOUT_COMPONENT.name} to the imports of the root component, in place of RouterOutlet:`,
    `  imports: [${LAYOUT_COMPONENT.name}],`,
  ];
  const content = `${commentBlock(PIDRANG_COMMENT, steps)}\n${rest}`;
  return content === source
    ? { kind: 'unchanged' }
    : { kind: 'manual', content, reason };
}

function componentMetadata(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): ts.ObjectLiteralExpression | null {
  const decorators = callsTo(typescript, file, 'Component').filter((call) =>
    typescript.isDecorator(call.parent),
  );
  if (decorators.length !== 1) {
    return null;
  }
  const [metadata] = decorators[0].arguments;
  return metadata !== undefined &&
    typescript.isObjectLiteralExpression(metadata)
    ? metadata
    : null;
}

function importsProperty(
  typescript: TypeScriptApi,
  metadata: ts.ObjectLiteralExpression,
): ts.PropertyAssignment | undefined {
  return metadata.properties.find(
    (property): property is ts.PropertyAssignment =>
      typescript.isPropertyAssignment(property) &&
      typescript.isIdentifier(property.name) &&
      property.name.text === 'imports',
  );
}

function namedElement(
  typescript: TypeScriptApi,
  array: ts.ArrayLiteralExpression,
  name: string,
): ts.Expression | undefined {
  return array.elements.find(
    (element) => typescript.isIdentifier(element) && element.text === name,
  );
}

function routerOutletImport(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): { declaration: ts.ImportDeclaration; specifier: ts.ImportSpecifier } | null {
  for (const statement of file.statements) {
    if (
      !typescript.isImportDeclaration(statement) ||
      !typescript.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@angular/router'
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !typescript.isNamedImports(bindings)) {
      continue;
    }
    const specifier = bindings.elements.find(
      (element) =>
        element.name.text === ROUTER_OUTLET &&
        element.propertyName === undefined,
    );
    if (specifier !== undefined) {
      return { declaration: statement, specifier };
    }
  }
  return null;
}

function removeSpecifier(
  source: string,
  declaration: ts.ImportDeclaration,
  specifier: ts.ImportSpecifier,
): TextChange {
  const elements = (declaration.importClause?.namedBindings as ts.NamedImports)
    .elements;
  if (elements.length === 1) {
    const start = declaration.getFullStart();
    if (start > 0) {
      return { from: start, to: declaration.end, text: '' };
    }
    const end =
      source[declaration.end] === '\n' ? declaration.end + 1 : declaration.end;
    return { from: declaration.getStart(), to: end, text: '' };
  }
  const index = elements.indexOf(specifier);
  return index < elements.length - 1
    ? {
        from: specifier.getStart(),
        to: elements[index + 1].getStart(),
        text: '',
      }
    : { from: elements[index - 1].end, to: specifier.end, text: '' };
}

function replaceRouterOutlet(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
  source: string,
  outlet: ts.Expression,
): TextChange[] | null {
  const found = routerOutletImport(typescript, file);
  const references = findAll(file, typescript.isIdentifier).filter(
    (identifier) => identifier.text === ROUTER_OUTLET,
  );
  if (found === null || references.length !== 2) {
    return null;
  }
  return [
    { from: outlet.getStart(), to: outlet.end, text: LAYOUT_COMPONENT.name },
    removeSpecifier(source, found.declaration, found.specifier),
  ];
}

function appendLayout(
  source: string,
  array: ts.ArrayLiteralExpression,
): TextChange {
  if (!sameLine(source, array.getStart(), array.end)) {
    const insertion = appendElement(source, array, () => LAYOUT_COMPONENT.name);
    return { from: insertion.at, to: insertion.at, text: insertion.text };
  }
  const last = array.elements[array.elements.length - 1];
  if (last === undefined) {
    const at = array.getStart() + 1;
    return { from: at, to: array.end - 1, text: LAYOUT_COMPONENT.name };
  }
  const text = array.elements.hasTrailingComma
    ? ` ${LAYOUT_COMPONENT.name}`
    : `, ${LAYOUT_COMPONENT.name}`;
  const at = array.elements.hasTrailingComma
    ? source.indexOf(',', last.end) + 1
    : last.end;
  return { from: at, to: at, text };
}

function layoutChanges(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
  source: string,
  metadata: ts.ObjectLiteralExpression,
): TextChange[] | string {
  const property = importsProperty(typescript, metadata);
  if (property === undefined) {
    const first = metadata.properties[0];
    if (first === undefined) {
      return 'the root component has no metadata to add the layout to';
    }
    const at = first.getStart();
    return [
      {
        from: at,
        to: at,
        text: `imports: [${LAYOUT_COMPONENT.name}],\n${lineIndent(source, at)}`,
      },
    ];
  }
  const array = unwrapExpression(typescript, property.initializer);
  if (!typescript.isArrayLiteralExpression(array)) {
    return 'the imports of the root component are not a plain array';
  }
  if (namedElement(typescript, array, LAYOUT_COMPONENT.name) !== undefined) {
    return [];
  }
  const outlet = namedElement(typescript, array, ROUTER_OUTLET);
  const replaced =
    outlet === undefined
      ? null
      : replaceRouterOutlet(typescript, file, source, outlet);
  if (replaced !== null) {
    return replaced;
  }
  return [appendLayout(source, array)];
}

export function editAppComponent(
  typescript: TypeScriptApi | null,
  path: string,
  source: string,
): FileEdit {
  if (typescript === null) {
    return manual(source, 'TypeScript is not installed in this app');
  }
  const file = parseSource(typescript, path, source);
  const metadata = componentMetadata(typescript, file);
  if (metadata === null) {
    return manual(source, 'no single @Component with its metadata was found');
  }
  if (nameConflicts(typescript, file, [LAYOUT_COMPONENT], []).length > 0) {
    return manual(
      source,
      `the file already uses ${LAYOUT_COMPONENT.name} for something else`,
    );
  }
  const changes = layoutChanges(typescript, file, source, metadata);
  if (typeof changes === 'string') {
    return manual(source, changes);
  }
  const imports = importInsertions(typescript, file, [LAYOUT_COMPONENT]).map(
    (insertion) => ({
      from: insertion.at,
      to: insertion.at,
      text: insertion.text,
    }),
  );
  const content = applyChanges(source, [...imports, ...changes]);
  return content === source
    ? { kind: 'unchanged' }
    : { kind: 'edited', content };
}
