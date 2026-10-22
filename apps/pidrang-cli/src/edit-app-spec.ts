import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import {
  LAYOUT_COMPONENT,
  TextChange,
  applyChanges,
} from './edit-app-component';
import { lineIndent, stripLeadingLines } from './text-edit';
import {
  callsTo,
  importInsertions,
  nameConflicts,
  parseSource,
} from './ts-source';

export const WELCOME_TITLE_TEST = 'should render title';

const READS_HEADING = /querySelector\(\s*['"`]h1['"`]\s*\)/;

interface SpecTest {
  title: string;
  statement: ts.ExpressionStatement;
}

function headingTests(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
): SpecTest[] {
  return callsTo(typescript, file, 'it').flatMap((call) => {
    const [title] = call.arguments;
    const statement = call.parent;
    if (
      title === undefined ||
      !typescript.isStringLiteralLike(title) ||
      !typescript.isExpressionStatement(statement) ||
      !READS_HEADING.test(statement.getText(file))
    ) {
      return [];
    }
    return [{ title: title.text, statement }];
  });
}

function manual(
  source: string,
  rest: string,
  steps: string[],
  reason: string,
): FileEdit {
  const content = `${commentBlock(PIDRANG_COMMENT, steps)}\n${rest}`;
  return content === source
    ? { kind: 'unchanged' }
    : { kind: 'manual', content, reason };
}

function removals(statements: ts.Statement[]): TextChange[] {
  return statements.map((statement) => ({
    from: statement.getFullStart(),
    to: statement.end,
    text: '',
  }));
}

const SCHEMA_IMPORT = { name: 'CUSTOM_ELEMENTS_SCHEMA', from: '@angular/core' };

function layoutOverride(indent: string): string {
  return [
    `TestBed.overrideComponent(App, {`,
    `${indent}  remove: { imports: [${LAYOUT_COMPONENT.name}] },`,
    `${indent}  add: { schemas: [${SCHEMA_IMPORT.name}] },`,
    `${indent}});`,
  ].join('\n');
}

const LAYOUT_STEPS = [
  'The root component now renders the navigation layout, which needs providePidrang. Keep it out of the root component test:',
  `  import { ${SCHEMA_IMPORT.name} } from '${SCHEMA_IMPORT.from}';`,
  `  import { ${LAYOUT_COMPONENT.name} } from '${LAYOUT_COMPONENT.from}';`,
  '  and at the top of beforeEach:',
  ...layoutOverride('')
    .split('\n')
    .map((line) => `  ${line}`),
];

function overridesLayout(source: string): boolean {
  return source.includes(`remove: { imports: [${LAYOUT_COMPONENT.name}] }`);
}

function layoutChanges(
  typescript: TypeScriptApi,
  file: ts.SourceFile,
  source: string,
): TextChange[] | null {
  if (overridesLayout(source)) {
    return [];
  }
  const imports = [SCHEMA_IMPORT, LAYOUT_COMPONENT];
  if (nameConflicts(typescript, file, imports, []).length > 0) {
    return null;
  }
  const setups = callsTo(typescript, file, 'beforeEach').flatMap((call) => {
    const [callback] = call.arguments;
    if (
      callback === undefined ||
      !(
        typescript.isArrowFunction(callback) ||
        typescript.isFunctionExpression(callback)
      ) ||
      !typescript.isBlock(callback.body) ||
      !callback.body.getText(file).includes('configureTestingModule')
    ) {
      return [];
    }
    return [callback.body];
  });
  const first = setups.length === 1 ? setups[0].statements[0] : undefined;
  if (first === undefined) {
    return null;
  }
  const at = first.getStart();
  const indent = lineIndent(source, at);
  return [
    ...importInsertions(typescript, file, imports).map((insertion) => ({
      from: insertion.at,
      to: insertion.at,
      text: insertion.text,
    })),
    { from: at, to: at, text: `${layoutOverride(indent)}\n\n${indent}` },
  ];
}

export function editAppSpec(
  typescript: TypeScriptApi | null,
  path: string,
  source: string,
  withLayout = false,
): FileEdit {
  const rest = stripLeadingLines(source, PIDRANG_COMMENT);
  const intro = withLayout
    ? 'pidrang replaced the welcome page of app.html with the navigation layout, so the app no longer renders the h1 these tests read.'
    : 'pidrang replaced the welcome page of app.html with <router-outlet />, so the app no longer renders the h1 these tests read.';
  const headingSteps = [
    intro,
    'Delete these tests or make them check your own content, then delete these pidrang lines.',
  ];
  if (typescript === null) {
    const steps = [
      ...(READS_HEADING.test(rest) ? headingSteps : []),
      ...(withLayout && !overridesLayout(rest) ? LAYOUT_STEPS : []),
    ];
    return steps.length > 0
      ? manual(source, rest, steps, 'TypeScript is not installed in this app')
      : { kind: 'unchanged' };
  }
  const file = parseSource(typescript, path, rest);
  const tests = headingTests(typescript, file);
  const welcome = tests.filter((test) => test.title === WELCOME_TITLE_TEST);
  const others = tests.filter((test) => test.title !== WELCOME_TITLE_TEST);
  const override = withLayout ? layoutChanges(typescript, file, rest) : [];
  const content = applyChanges(rest, [
    ...removals(welcome.map((test) => test.statement)),
    ...(override ?? []),
  ]);
  const steps = [
    ...(others.length > 0
      ? [
          intro,
          'Delete these tests or make them check your own content, then delete these pidrang lines:',
          ...others.map((test) => `  ${test.title}`),
        ]
      : []),
    ...(override === null ? LAYOUT_STEPS : []),
  ];
  if (steps.length > 0) {
    return manual(
      source,
      content,
      steps,
      others.length > 0
        ? 'some tests read the h1 of the welcome page'
        : 'no single beforeEach configures the test module',
    );
  }
  return content === source
    ? { kind: 'unchanged' }
    : { kind: 'edited', content };
}
