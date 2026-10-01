export function conformanceId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
