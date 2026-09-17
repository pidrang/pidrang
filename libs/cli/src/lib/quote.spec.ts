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
});
