import { isSupabaseConfigured } from './is-supabase-configured';

describe('isSupabaseConfigured', () => {
  it('returns true when both url and anonKey are set', () => {
    expect(
      isSupabaseConfigured('https://project.supabase.co', 'anon-key'),
    ).toBe(true);
  });

  it('returns false when url is empty', () => {
    expect(isSupabaseConfigured('', 'anon-key')).toBe(false);
  });

  it('returns false when anonKey is empty', () => {
    expect(isSupabaseConfigured('https://project.supabase.co', '')).toBe(false);
  });

  it('returns false when both are empty', () => {
    expect(isSupabaseConfigured('', '')).toBe(false);
  });
});
