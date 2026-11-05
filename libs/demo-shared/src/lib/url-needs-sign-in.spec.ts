import { urlNeedsSignIn } from './url-needs-sign-in';

const guarded = new Set(['secrets']);

describe('urlNeedsSignIn', () => {
  it('leaves the root and an empty URL alone', () => {
    expect(urlNeedsSignIn('/', guarded)).toBe(false);
    expect(urlNeedsSignIn('', guarded)).toBe(false);
  });

  it('leaves the list and show pages of an unprotected resource alone', () => {
    expect(urlNeedsSignIn('/products', guarded)).toBe(false);
    expect(urlNeedsSignIn('/products/1', guarded)).toBe(false);
  });

  it('asks for a session on the create and edit pages of any resource', () => {
    expect(urlNeedsSignIn('/products/create', guarded)).toBe(true);
    expect(urlNeedsSignIn('/products/1/edit', guarded)).toBe(true);
  });

  it('ignores the query string and the hash', () => {
    expect(urlNeedsSignIn('/products/create?x=1', guarded)).toBe(true);
    expect(urlNeedsSignIn('/products/1/edit#top', guarded)).toBe(true);
  });

  it('asks for a session on every page of a guarded resource', () => {
    expect(urlNeedsSignIn('/secrets', guarded)).toBe(true);
    expect(urlNeedsSignIn('/secrets/1', guarded)).toBe(true);
    expect(urlNeedsSignIn('/secrets?page=2', guarded)).toBe(true);
  });

  it('leaves deeper URLs alone', () => {
    expect(urlNeedsSignIn('/products/create/extra', guarded)).toBe(false);
    expect(urlNeedsSignIn('/products/1/edit/extra', guarded)).toBe(false);
  });

  it('still asks for a session on a create page when nothing is guarded', () => {
    expect(urlNeedsSignIn('/secrets', new Set())).toBe(false);
    expect(urlNeedsSignIn('/products/create', new Set())).toBe(true);
  });
});
