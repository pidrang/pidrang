import type * as ts from 'typescript';
import { AppSetup, SetupImport } from '@pidrang/cli';
import { TypeScriptApi } from './app-tooling';
import { quote } from './edit-app-routes';
import {
  TextInsertion,
  applyInsertions,
  lineIndent,
  nextNonSpace,
  sameLine,
  stripLeadingLines,
} from './text-edit';
import {
  callsTo,
  importInsertions,
  lastImportEnd,
  nameConflicts,
  parseSource,
  unwrapExpression,
} from './ts-source';

export const PIDRANG_COMMENT = '// pidrang:';

export type FileEdit =
  | { kind: 'unchanged' }
  | { kind: 'edited'; content: string }
  | { kind: 'manual'; content: string; reason: string };

export interface ConfigRequest {
  setup: AppSetup;
  environmentImport: string | null;
  resourcesImport: string;
  signInPath?: string;
}

const BINDING_IMPORT: SetupImport = {
  name: 'withComponentInputBinding',
  from: '@angular/router',
};

const SIGN_IN_IMPORT: SetupImport = {
  name: 'provideSignInPath',
  from: './pidrang/index',
};

function setupImports(request: ConfigRequest): SetupImport[] {
  return [
    ...(request.signInPath === undefined ? [] : [SIGN_IN_IMPORT]),
    ...request.setup.imports,
    ...(request.environmentImport === null
      ? []
      : [{ name: 'environment', from: request.environmentImport }]),
    { name: 'resources', from: request.resourcesImport },
  ];
}

function pidrangCall(setup: AppSetup, indent: string): string {
  const properties = [
    ...setup.pidrangConfig.map(
      (property) => `${property.name}: ${property.value}`,
    ),
    'resources',
  ];
  return [
    'providePidrang({',
    ...properties.map((property) => `${indent}  ${property},`),
    `${indent}})`,
  ].join('\n');
}

function constantLines(setup: AppSetup): string[] {
  return setup.constants.map(
    (constant) => `const ${constant.name} = ${constant.initializer};`,
  );
}

function findProviders(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): { statement: ts.Statement; providers: ts.ArrayLiteralExpression } | null {
  const candidates = file.statements.flatMap((statement) => {
    if (!typescript.isVariableStatement(statement)) {
      return [];
    }
    return statement.declarationList.declarations.flatMap((declaration) => {
      if (!declaration.initializer) {
        return [];
      }
      const config = unwrapExpression(typescript, declaration.initializer);
      if (!typescript.isObjectLiteralExpression(config)) {
        return [];
      }
      const property = config.properties.find(
        (entry): entry is ts.PropertyAssignment =>
          typescript.isPropertyAssignment(entry) &&
          typescript.isIdentifier(entry.name) &&
          entry.name.text === 'providers',
      );
      const providers = property
        ? unwrapExpression(typescript, property.initializer)
        : null;
      if (!providers || !typescript.isArrayLiteralExpression(providers)) {
        return [];
      }
      const name = typescript.isIdentifier(declaration.name)
        ? declaration.name.text
        : '';
      return [{ name, statement, providers }];
    });
  });
  const named = candidates.filter(
    (candidate) => candidate.name === 'appConfig',
  );
  const chosen = named.length === 1 ? named : candidates;
  return chosen.length === 1 ? chosen[0] : null;
}

export function appendElement(
  source: string,
  array: ts.ArrayLiteralExpression,
  element: (indent: string) => string,
): TextInsertion {
  const last = array.elements[array.elements.length - 1];
  const open = array.getStart();
  if (!last) {
    const indent = `${lineIndent(source, open)}  `;
    return {
      at: open + 1,
      text: `\n${indent}${element(indent)},\n${lineIndent(source, open)}`,
    };
  }
  const indent = sameLine(source, open, last.getStart())
    ? `${lineIndent(source, open)}  `
    : lineIndent(source, last.getStart());
  const afterLast = nextNonSpace(source, last.end);
  return source[afterLast] === ','
    ? { at: afterLast + 1, text: `\n${indent}${element(indent)},` }
    : { at: last.end, text: `,\n${indent}${element(indent)}` };
}

function manualSteps(
  request: ConfigRequest,
  needsBinding: boolean,
  needsPidrang: boolean,
): string[] {
  const imports = [
    ...(needsBinding ? [BINDING_IMPORT] : []),
    ...(needsPidrang || request.signInPath !== undefined
      ? setupImports(request)
      : []),
  ];
  const steps = [
    'pidrang could not edit this file safely. Make these changes by hand, then delete these pidrang lines.',
    'Add these imports:',
    ...imports.map(
      (entry) => `  import { ${entry.name} } from '${entry.from}';`,
    ),
  ];
  if (needsPidrang && request.setup.constants.length > 0) {
    steps.push('Add this after the imports:');
    steps.push(...constantLines(request.setup).map((line) => `  ${line}`));
  }
  if (needsBinding) {
    steps.push(
      'Pass withComponentInputBinding() to provideRouter, the pages read :resource and :id as inputs:',
      '  provideRouter(routes, withComponentInputBinding())',
    );
  }
  if (request.signInPath !== undefined) {
    steps.push(
      'Add this to the providers of your application config, with the path of your sign-in page:',
      `  provideSignInPath('${request.signInPath}')`,
    );
  }
  if (needsPidrang) {
    steps.push('Add this to the providers of your application config:');
    steps.push(
      ...pidrangCall(request.setup, '')
        .split('\n')
        .map((line) => `  ${line}`),
    );
  }
  return steps;
}

export function commentBlock(marker: string, steps: string[]): string {
  return steps.map((step) => `${marker} ${step}`.trimEnd()).join('\n');
}

function manual(
  source: string,
  request: ConfigRequest,
  needsBinding: boolean,
  needsPidrang: boolean,
  reason: string,
): FileEdit {
  const rest = stripLeadingLines(source, PIDRANG_COMMENT);
  const content = `${commentBlock(PIDRANG_COMMENT, manualSteps(request, needsBinding, needsPidrang))}\n${rest}`;
  return content === source
    ? { kind: 'unchanged' }
    : { kind: 'manual', content, reason };
}

export function editAppConfig(
  typescript: TypeScriptApi | null,
  path: string,
  source: string,
  request: ConfigRequest,
): FileEdit {
  if (typescript === null) {
    return manual(
      source,
      request,
      true,
      true,
      'TypeScript is not installed in this app',
    );
  }
  const file = parseSource(typescript, path, source);
  const needsBinding =
    callsTo(typescript, file, BINDING_IMPORT.name).length === 0;
  const needsPidrang = callsTo(typescript, file, 'providePidrang').length === 0;
  const needsSignIn =
    request.signInPath !== undefined &&
    callsTo(typescript, file, 'provideSignInPath').length === 0;
  if (!needsBinding && !needsPidrang && !needsSignIn) {
    return { kind: 'unchanged' };
  }
  const fail = (reason: string) =>
    manual(source, request, needsBinding, needsPidrang, reason);

  const found = findProviders(typescript, file);
  if (found === null) {
    return fail(
      'no single application config with a providers array was found',
    );
  }
  const insertions: TextInsertion[] = [];
  const imports: SetupImport[] = [];

  if (needsBinding) {
    const routers = found.providers.elements.filter(
      (element): element is ts.CallExpression =>
        typescript.isCallExpression(element) &&
        typescript.isIdentifier(element.expression) &&
        element.expression.text === 'provideRouter',
    );
    if (routers.length !== 1 || routers[0].arguments.length === 0) {
      return fail('provideRouter(routes) was not found in the providers');
    }
    const lastArgument = routers[0].arguments[routers[0].arguments.length - 1];
    insertions.push({
      at: lastArgument.end,
      text: `, ${BINDING_IMPORT.name}()`,
    });
    imports.push(BINDING_IMPORT);
  }

  if (needsSignIn) {
    const signInPath = request.signInPath ?? '';
    insertions.push(
      appendElement(
        source,
        found.providers,
        () => `provideSignInPath(${quote(signInPath)})`,
      ),
    );
    imports.push(SIGN_IN_IMPORT);
  }

  if (needsPidrang) {
    const pidrangImports = setupImports(request);
    const locals = request.setup.constants.map((constant) => constant.name);
    const conflicts = nameConflicts(typescript, file, pidrangImports, locals);
    if (conflicts.length > 0) {
      return fail(
        `the file already uses ${conflicts.join(', ')} for something else`,
      );
    }
    imports.push(...pidrangImports);
    const constants = constantLines(request.setup);
    if (constants.length > 0) {
      const after = lastImportEnd(typescript, file);
      insertions.push(
        after === null
          ? {
              at: found.statement.getStart(),
              text: `${constants.join('\n')}\n\n`,
            }
          : { at: after, text: `\n\n${constants.join('\n')}` },
      );
    }
    insertions.push(
      appendElement(source, found.providers, (indent) =>
        pidrangCall(request.setup, indent),
      ),
    );
  }

  const content = applyInsertions(source, [
    ...importInsertions(typescript, file, imports),
    ...insertions,
  ]);
  return { kind: 'edited', content };
}
