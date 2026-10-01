import { DefaultUrlSerializer, PRIMARY_OUTLET, UrlTree } from '@angular/router';

const OUTSIDE_THE_APP = /^([a-z][a-z\d+.-]*:|\/\/)/i;

export function parseSignInPath(path: string): UrlTree {
  if (typeof path !== 'string') {
    throw new Error(
      `SIGN_IN_PATH must be a string such as '/auth/sign-in', got ${String(path)}`,
    );
  }
  if (
    path.trim() === '' ||
    path !== path.trim() ||
    OUTSIDE_THE_APP.test(path)
  ) {
    throw new Error(
      `SIGN_IN_PATH must be a path inside the app, such as '/auth/sign-in', got '${path}'`,
    );
  }
  let tree: UrlTree;
  try {
    tree = new DefaultUrlSerializer().parse(path);
  } catch {
    throw new Error(
      `SIGN_IN_PATH must be a valid URL path, such as '/auth/sign-in', got '${path}'`,
    );
  }
  const segments = tree.root.children[PRIMARY_OUTLET]?.segments ?? [];
  if (segments.some(({ path: part }) => part === '.' || part === '..')) {
    throw new Error(
      `SIGN_IN_PATH must be a path inside the app, such as '/auth/sign-in', got '${path}'`,
    );
  }
  if (
    segments
      .map(({ path: part }) => part)
      .filter((part) => part !== '')
      .join('/') === 'your-sign-in-route'
  ) {
    throw new Error(
      "SIGN_IN_PATH is still '/your-sign-in-route': replace the placeholder with the path of your app's sign-in page",
    );
  }
  return tree;
}
