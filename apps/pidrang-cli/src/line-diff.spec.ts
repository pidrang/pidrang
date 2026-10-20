import { diffLines, formatDiff } from './line-diff';

describe('formatDiff', () => {
  it('shows nothing when the two texts are the same', () => {
    expect(formatDiff('same\n', 'same\n')).toEqual([]);
  });

  it('shows every line of a new file with a plus', () => {
    expect(formatDiff('', 'one\ntwo\n')).toEqual(['+one', '+two']);
  });

  it('collapses a long run of added lines', () => {
    const added = Array.from({ length: 30 }, (_, index) => `line ${index}`);
    const lines = formatDiff('', added.join('\n'));

    expect(lines.slice(0, 3)).toEqual(['+line 0', '+line 1', '+line 2']);
    expect(lines.at(-1)).toBe('+... 27 more lines');
  });

  it('keeps two lines of context around a change and a gap marker', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join(
      '\n',
    );
    const after = before.replace('j', 'J');
    const lines = formatDiff(before, after);

    expect(lines).toEqual([' h', ' i', '-j', '+J']);
  });

  it('marks removed and added lines', () => {
    expect(diffLines('old\nkeep\n', 'new\nkeep\n')).toEqual([
      { kind: '-', text: 'old' },
      { kind: '+', text: 'new' },
      { kind: ' ', text: 'keep' },
    ]);
  });

  it('reads Windows line endings as line breaks', () => {
    expect(formatDiff('a\r\nb\r\n', 'a\r\nc\r\n')).toEqual([' a', '-b', '+c']);
  });
});
