export function recordLabel(record: Record<string, unknown>): string {
  if (typeof record['name'] === 'string' && record['name']) {
    return record['name'];
  }
  if (typeof record['email'] === 'string' && record['email']) {
    return record['email'];
  }
  const id = record['id'];
  return typeof id === 'string' ? id.slice(0, 8) : String(id);
}
