import { SaveFailure } from './save-failure';

export function navigationFailure(): SaveFailure {
  return {
    message: 'Saved, but the next page could not open.',
    authRequired: false,
  };
}
