export function isSupabaseConfigured(
  url: string,
  publishableKey: string,
): boolean {
  return !!url && !!publishableKey;
}
