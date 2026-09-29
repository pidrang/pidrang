export function isSupabaseConfigured(url: string, anonKey: string): boolean {
  return !!url && !!anonKey;
}
