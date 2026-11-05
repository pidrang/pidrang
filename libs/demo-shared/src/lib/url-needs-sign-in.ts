export function urlNeedsSignIn(
  url: string,
  guarded: ReadonlySet<string>,
): boolean {
  const path = url.split(/[?#]/)[0];
  const segments = path.split('/').filter((segment) => segment !== '');
  if (segments.length === 0) {
    return false;
  }
  if (guarded.has(segments[0])) {
    return true;
  }
  return (
    (segments.length === 2 && segments[1] === 'create') ||
    (segments.length === 3 && segments[2] === 'edit')
  );
}
