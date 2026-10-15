import { runInNewContext } from 'node:vm';
import { quote } from './quote';

describe('quote', () => {
  it('wraps a plain string in single quotes', () => {
    expect(quote('products')).toBe("'products'");
  });

  it('escapes single quotes', () => {
    expect(quote("o'clock")).toBe("'o\\'clock'");
  });

  it('escapes backslashes', () => {
    expect(quote('a\\b')).toBe("'a\\\\b'");
  });

  it('escapes newlines so the literal stays on one line', () => {
    expect(quote('a\nb')).toBe("'a\\nb'");
  });

  it('escapes carriage returns', () => {
    expect(quote('a\rb')).toBe("'a\\rb'");
  });

  it('keeps the literal on one line when a value mixes quotes, backslashes and newlines', () => {
    expect(quote("o'clock\\n\nreal newline\r")).toBe(
      "'o\\'clock\\\\n\\nreal newline\\r'",
    );
  });

  it.each([
    ['a plain name', 'products'],
    ['a capitalized name', 'Mixed'],
    ['a space', 'my col'],
    ['a double quote', 'say "hi"'],
    ['a trailing backslash', 'ends\\'],
    ['a backslash before a quote', "\\'"],
    ['a tab', 'a\tb'],
    ['a NUL character', 'a\u0000b'],
    ['a line separator', 'a b'],
    ['a paragraph separator', 'a b'],
    ['a template placeholder', '${x}'],
    ['a character outside the BMP', 'a\u{1D11E}b'],
    ['an escape-looking text', '\\u0041\\x41'],
  ])('produces a literal that evaluates back to %s', (_, value) => {
    expect(runInNewContext(quote(value))).toBe(value);
    expect(quote(value)).not.toMatch(/[\n\r]/);
  });
});
