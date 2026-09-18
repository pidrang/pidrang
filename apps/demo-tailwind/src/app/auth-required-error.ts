const AUTH_REQUIRED_ERROR_PATTERNS = [
  'row-level security',
  'permission denied for table',
];

export function isAuthRequiredError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return AUTH_REQUIRED_ERROR_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern),
  );
}
