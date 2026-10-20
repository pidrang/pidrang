export type DiffLine = { kind: ' ' | '+' | '-'; text: string };

const CONTEXT_LINES = 2;
const LONGEST_RUN = 8;
const RUN_HEAD = 3;

function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const common: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      common[i][j] =
        a[i] === b[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ kind: ' ', text: a[i] });
      i += 1;
      j += 1;
    } else if (
      j < b.length &&
      (i === a.length || common[i][j + 1] > common[i + 1][j])
    ) {
      lines.push({ kind: '+', text: b[j] });
      j += 1;
    } else {
      lines.push({ kind: '-', text: a[i] });
      i += 1;
    }
  }
  return lines;
}

function visibleLines(lines: DiffLine[]): (DiffLine | null)[] {
  const near = lines.map((line, index) =>
    lines
      .slice(Math.max(0, index - CONTEXT_LINES), index + CONTEXT_LINES + 1)
      .some((other) => other.kind !== ' '),
  );
  const visible: (DiffLine | null)[] = [];
  lines.forEach((line, index) => {
    if (near[index]) {
      visible.push(line);
    } else if (visible.at(-1) !== null && visible.length > 0) {
      visible.push(null);
    }
  });
  return visible.at(-1) === null ? visible.slice(0, -1) : visible;
}

function collapseRuns(lines: (DiffLine | null)[]): string[] {
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line === null) {
      output.push('...');
      index += 1;
      continue;
    }
    let end = index;
    while (end < lines.length && lines[end]?.kind === line.kind) {
      end += 1;
    }
    const run = lines.slice(index, end) as DiffLine[];
    const shown =
      line.kind !== ' ' && run.length > LONGEST_RUN
        ? run.slice(0, RUN_HEAD)
        : run;
    shown.forEach((entry) => output.push(`${entry.kind}${entry.text}`));
    if (shown.length < run.length) {
      output.push(`${line.kind}... ${run.length - shown.length} more lines`);
    }
    index = end;
  }
  return output;
}

export function formatDiff(before: string, after: string): string[] {
  return collapseRuns(visibleLines(diffLines(before, after)));
}
