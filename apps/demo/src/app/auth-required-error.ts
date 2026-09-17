export function isAuthRequiredError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /row-level security|permission denied for table/i.test(message);
}
