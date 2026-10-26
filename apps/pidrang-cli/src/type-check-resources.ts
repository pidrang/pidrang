import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';

const MODULE_NOT_FOUND = 2307;

export interface ResourcesTypeCheck {
  errors: string[];
  typed: boolean;
  fitsPidrang: boolean | null;
  exportedType: string | null;
  anyTyped: boolean;
}

function parsedConfig(
  typescript: TypeScriptApi,
  root: string,
  tsConfig: string | null,
): { options: ts.CompilerOptions; fileNames: string[] } {
  const configPath = [tsConfig, 'tsconfig.json']
    .filter((path): path is string => path !== null)
    .map((path) => join(root, path))
    .find((path) => existsSync(path));
  if (configPath === undefined) {
    return { options: {}, fileNames: [] };
  }
  const { config } = typescript.readConfigFile(
    configPath,
    typescript.sys.readFile,
  );
  const { options, fileNames } = typescript.parseJsonConfigFileContent(
    config ?? {},
    typescript.sys,
    dirname(configPath),
    undefined,
    configPath,
  );
  return { options, fileNames };
}

function holdsAny(
  typescript: TypeScriptApi,
  checker: ts.TypeChecker,
  type: ts.Type,
): boolean {
  if ((type.flags & typescript.TypeFlags.Any) !== 0) {
    return true;
  }
  return (
    (checker.isArrayType(type) || checker.isTupleType(type)) &&
    checker
      .getTypeArguments(type as ts.TypeReference)
      .some((argument) => (argument.flags & typescript.TypeFlags.Any) !== 0)
  );
}

function unusedPath(base: string): string {
  const name = (index: number) => `${base}${index === 0 ? '' : `-${index}`}.ts`;
  let index = 0;
  while (existsSync(name(index))) {
    index += 1;
  }
  return name(index);
}

export function typeCheckResources(
  typescript: TypeScriptApi,
  root: string,
  tsConfig: string | null,
  path: string,
  content: string,
): ResourcesTypeCheck {
  const file = resolve(root, path);
  const probe = unusedPath(join(dirname(file), 'pidrang-resources-probe'));
  const virtual = new Map([
    [file, content],
    [
      probe,
      `import type { PidrangConfig } from '@pidrang/core';\nimport { resources } from './${basename(file, '.ts')}.js';\nexport const probe: PidrangConfig['resources'] = resources;\n`,
    ],
  ]);
  const config = parsedConfig(typescript, root, tsConfig);
  const options = {
    ...config.options,
    noEmit: true,
    skipLibCheck: true,
    incremental: false,
    composite: false,
    noCheck: false,
    strictNullChecks: true,
  };
  const host = typescript.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.getSourceFile = (name, version, onError, create) => {
    const text = virtual.get(resolve(name));
    return text === undefined
      ? getSourceFile(name, version, onError, create)
      : typescript.createSourceFile(name, text, version, true);
  };
  host.readFile = (name) => virtual.get(resolve(name)) ?? readFile(name);
  host.fileExists = (name) => virtual.has(resolve(name)) || fileExists(name);
  const directoryExists = host.directoryExists?.bind(host);
  host.directoryExists = (name) =>
    resolve(name) === dirname(file) || (directoryExists?.(name) ?? true);
  const program = typescript.createProgram(
    [
      ...new Set([
        ...config.fileNames.map((name) => resolve(name)),
        file,
        probe,
      ]),
    ],
    options,
    host,
  );
  const diagnostics = (source?: ts.SourceFile) => [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
  ];
  const message = (diagnostic: ts.Diagnostic) =>
    typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const coreMissing = (diagnostic: ts.Diagnostic) =>
    diagnostic.code === MODULE_NOT_FOUND &&
    message(diagnostic).includes("'@pidrang/core'");
  const checker = program.getTypeChecker();
  const resourcesFile = program.getSourceFile(file);
  const moduleSymbol =
    resourcesFile === undefined
      ? undefined
      : checker.getSymbolAtLocation(resourcesFile);
  const exported =
    moduleSymbol === undefined
      ? undefined
      : checker
          .getExportsOfModule(moduleSymbol)
          .find((symbol) => symbol.name === 'resources');
  const fileDiagnostics = diagnostics(resourcesFile);
  const probeDiagnostics = diagnostics(program.getSourceFile(probe));
  return {
    errors: diagnostics().map(
      (diagnostic) =>
        `${relative(root, diagnostic.file?.fileName ?? root) || 'tsconfig'}: ${message(diagnostic)}`,
    ),
    typed: fileDiagnostics.every(coreMissing),
    fitsPidrang: probeDiagnostics.some(coreMissing)
      ? null
      : probeDiagnostics.length === 0,
    anyTyped:
      exported !== undefined &&
      holdsAny(typescript, checker, checker.getTypeOfSymbol(exported)),
    exportedType:
      exported === undefined
        ? null
        : checker.typeToString(
            checker.getTypeOfSymbol(exported),
            undefined,
            typescript.TypeFormatFlags.NoTruncation,
          ),
  };
}
