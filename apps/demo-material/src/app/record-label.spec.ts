import { recordLabel } from './record-label';

describe('recordLabel', () => {
  it('prefers name when present', () => {
    expect(
      recordLabel({
        id: '11111111-1111',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      }),
    ).toBe('Ada Lovelace');
  });

  it('falls back to email when there is no name', () => {
    expect(recordLabel({ id: '11111111-1111', email: 'ada@example.com' })).toBe(
      'ada@example.com',
    );
  });

  it('falls back to a shortened id when there is no name or email', () => {
    expect(recordLabel({ id: '11111111-1111-1111-1111-111111111111' })).toBe(
      '11111111',
    );
  });

  it('stringifies a non-string id as a last resort', () => {
    expect(recordLabel({ id: 42 })).toBe('42');
  });
});
