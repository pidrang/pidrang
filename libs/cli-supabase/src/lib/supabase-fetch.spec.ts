import { SupabaseConnectionError } from './supabase-connection-error';
import { supabaseFetch } from './supabase-fetch';

const URL = 'https://abcd.supabase.co/rest/v1/';

async function failureOf(rejection: unknown): Promise<SupabaseConnectionError> {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(rejection));
  return supabaseFetch(URL).then(
    () => {
      throw new Error('expected the request to fail');
    },
    (error: SupabaseConnectionError) => error,
  );
}

describe('supabaseFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes the request on with a timeout signal', async () => {
    const response = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    expect(await supabaseFetch(URL, { headers: { apikey: 'key' } })).toBe(
      response,
    );
    expect(fetchMock).toHaveBeenCalledWith(URL, {
      headers: { apikey: 'key' },
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    ['a DNS failure', { cause: { code: 'ENOTFOUND' } }, 'ENOTFOUND'],
    [
      'a refused connection',
      { cause: { code: 'ECONNREFUSED' } },
      'ECONNREFUSED',
    ],
    [
      'a cause without a code',
      { cause: { message: 'socket hang up' } },
      'socket hang up',
    ],
  ])('reports %s as an unreachable URL', async (_, details, reason) => {
    const error = await failureOf(
      Object.assign(new TypeError('fetch failed'), details),
    );
    expect(error).toBeInstanceOf(SupabaseConnectionError);
    expect(error.problem).toBe('unreachable-url');
    expect(error.message).toBe(
      `Could not reach https://abcd.supabase.co (${reason}). Check the project URL in Project Settings, API.`,
    );
  });

  it('reports a timeout as an unreachable URL', async () => {
    const error = await failureOf(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );
    expect(error.problem).toBe('unreachable-url');
    expect(error.message).toContain('(no answer after 15 seconds)');
  });
});
