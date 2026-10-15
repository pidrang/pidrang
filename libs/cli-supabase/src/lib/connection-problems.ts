export function normalizeProjectUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function projectUrlProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Enter the project URL, such as https://abcdefgh.supabase.co';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'The project URL must start with https:// (or http:// for a local stack)';
  }
  if (url.username || url.password || url.search || url.hash) {
    return 'The project URL must not contain credentials, a query or a fragment';
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return 'Enter the project URL only, without /rest/v1 or any other path';
  }
  return null;
}

export function requiredValueProblem(
  label: string,
  value: string,
): string | null {
  return value.trim() === '' ? `${label} is required` : null;
}

export function portProblem(value: string): string | null {
  const port = Number(value.trim());
  return /^\d+$/.test(value.trim()) && port >= 1 && port <= 65535
    ? null
    : 'The port must be a whole number between 1 and 65535';
}
