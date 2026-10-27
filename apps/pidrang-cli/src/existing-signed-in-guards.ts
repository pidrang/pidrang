import { generateResourceRoutesFile } from '@pidrang/cli';

const GUARD = 'canMatchSignedIn([';
const QUOTED = /\s*'((?:[^'\\]|\\.)*)'\s*,?/y;
const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

function singleQuoted(literal: string): string {
  const body = literal
    .slice(1, -1)
    .replace(
      /\\(.)|(['"])/g,
      (_, escaped: string | undefined, quote: string) =>
        escaped === undefined
          ? quote === "'"
            ? "\\'"
            : '"'
          : escaped === '"'
            ? '"'
            : `\\${escaped}`,
    );
  return `'${body}'`;
}

function guardedNames(source: string): string[] {
  const start = source.indexOf(GUARD);
  if (start < 0) {
    return [];
  }
  const names: string[] = [];
  QUOTED.lastIndex = start + GUARD.length;
  for (let match = QUOTED.exec(source); match; match = QUOTED.exec(source)) {
    names.push(unquote(match[1]));
  }
  return names;
}

function unquote(text: string): string {
  return text.replace(/\\(.)/g, (_, character: string) =>
    character === 'n' ? '\n' : character === 'r' ? '\r' : character,
  );
}

export function existingSignedInGuards(
  content: string,
  signInRoute: boolean,
): string[] | null {
  const source = content.replace(/\r\n/g, '\n').replace(STRING, singleQuoted);
  const names = guardedNames(source);
  return generateResourceRoutesFile(signInRoute, names).content.replace(
    STRING,
    singleQuoted,
  ) === source
    ? names
    : null;
}
