import { isSupabaseConfigured } from './is-supabase-configured';

describe('isSupabaseConfigured', () => {
  it('returns true when both url and publishableKey are set', () => {
    expect(
      isSupabaseConfigured('https://project.supabase.co', 'publishable-key'),
    ).toBe(true);
  });

  it('returns false when url is empty', () => {
    expect(isSupabaseConfigured('', 'publishable-key')).toBe(false);
  });

  it('returns false when publishableKey is empty', () => {
    expect(isSupabaseConfigured('https://project.supabase.co', '')).toBe(false);
  });

  it('returns false when both are empty', () => {
    expect(isSupabaseConfigured('', '')).toBe(false);
  });
});
