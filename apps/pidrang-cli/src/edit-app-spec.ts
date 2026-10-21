import type * as ts from 'typescript';
import { TypeScriptApi } from './app-tooling';
import { FileEdit, PIDRANG_COMMENT, commentBlock } from './edit-app-config';
import { stripLeadingLines } from './text-edit';
import { callsTo, parseSource } from './ts-source';

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

function removeStatements(source: string, statements: ts.Statement[]): string {
  return [...statements]
    .sort((a, b) => b.getFullStart() - a.getFullStart())
    .reduce(
      (text, statement) =>
        text.slice(0, statement.getFullStart()) + text.slice(statement.end),
      source,
    );
}

export function editAppSpec(
  typescript: TypeScriptApi | null,
  path: string,
  source: string,
): FileEdit {
  const rest = stripLeadingLines(source, PIDRANG_COMMENT);
  const intro =
    'pidrang replaced the welcome page of app.html with <router-outlet />, so the app no longer renders the h1 these tests read.';
  if (typescript === null) {
    return READS_HEADING.test(rest)
      ? manual(
          source,
          rest,
          [
            intro,
            'Delete these tests or make them check your own content, then delete these pidrang lines.',
          ],
          'TypeScript is not installed in this app',
        )
      : { kind: 'unchanged' };
  }
  const file = parseSource(typescript, path, rest);
  const tests = headingTests(typescript, file);
  const welcome = tests.filter((test) => test.title === WELCOME_TITLE_TEST);
  const others = tests.filter((test) => test.title !== WELCOME_TITLE_TEST);
  const content = removeStatements(
    rest,
    welcome.map((test) => test.statement),
  );
  if (others.length > 0) {
    return manual(
      source,
      content,
      [
        intro,
        'Delete these tests or make them check your own content, then delete these pidrang lines:',
        ...others.map((test) => `  ${test.title}`),
      ],
      'some tests read the h1 of the welcome page',
    );
  }
  return content === source
    ? { kind: 'unchanged' }
    : { kind: 'edited', content };
}
