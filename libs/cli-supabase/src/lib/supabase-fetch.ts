import {
  SUPABASE_TIMEOUT_MS,
  unreachableUrlError,
} from './supabase-connection-error';

export async function supabaseFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
  } catch (error) {
    throw unreachableUrlError(url, error);
  }
}
