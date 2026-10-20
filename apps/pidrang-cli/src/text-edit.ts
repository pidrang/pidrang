export interface TextInsertion {
  at: number;
  text: string;
}

export function applyInsertions(
  source: string,
  insertions: TextInsertion[],
): string {
  return insertions
    .map((insertion, order) => ({ ...insertion, order }))
    .sort((a, b) => b.at - a.at || b.order - a.order)
    .reduce(
      (text, insertion) =>
        text.slice(0, insertion.at) + insertion.text + text.slice(insertion.at),
      source,
    );
}

export function lineIndent(source: string, position: number): string {
  const lineStart = source.lastIndexOf('\n', position - 1) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? '';
}

export function sameLine(source: string, from: number, to: number): boolean {
  return !source.slice(from, to).includes('\n');
}

export function nextNonSpace(source: string, position: number): number {
  let index = position;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return index;
}

export function stripLeadingLines(source: string, marker: string): string {
  const lines = source.split('\n');
  let index = 0;
  while (index < lines.length && lines[index].startsWith(marker)) {
    index += 1;
  }
  return lines.slice(index).join('\n');
}
