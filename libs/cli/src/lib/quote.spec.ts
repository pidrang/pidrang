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
});
