export type SupabaseConnectionProblem =
  | 'rejected-key'
  | 'graphql-disabled'
  | 'unreachable-url';

export class SupabaseConnectionError extends Error {
  constructor(
    readonly problem: SupabaseConnectionProblem,
    message: string,
  ) {
    super(message);
    this.name = 'SupabaseConnectionError';
  }
}

interface ErrorBody {
  code?: string;
  message?: string;
}

const REJECTED_KEY_MESSAGES = [/no api key found/i, /invalid api key/i];

export type ApiKeyKind = 'publishable' | 'secret';

const KEY_SOURCES: Record<ApiKeyKind, string> = {
  publishable: 'the Connect button at the top of the Supabase dashboard',
  secret: 'Project Settings, API Keys in the Supabase dashboard',
};

export function rejectedKeyError(
  kind: ApiKeyKind,
  status: number,
  body: ErrorBody,
): SupabaseConnectionError | null {
  const message = body.message ?? '';
  if (
    status !== 401 &&
    !REJECTED_KEY_MESSAGES.some((pattern) => pattern.test(message))
  ) {
    return null;
  }
  return new SupabaseConnectionError(
    'rejected-key',
    `Supabase refused the ${kind} key (${status}${message ? `: ${message}` : ''}). Copy it again from ${KEY_SOURCES[kind]}.`,
  );
}

const MISSING_GRAPHQL_FUNCTION = 'PGRST202';

export function graphQlDisabledError(
  body: ErrorBody & { errors?: { message: string }[] },
): SupabaseConnectionError | null {
  const disabled =
    body.code === MISSING_GRAPHQL_FUNCTION ||
    (body.errors ?? []).some((error) =>
      /pg_graphql extension is not enabled/i.test(error.message),
    );
  return disabled
    ? new SupabaseConnectionError(
        'graphql-disabled',
        'The pg_graphql extension is not enabled on this project. Enable it in the Supabase dashboard (Database, Extensions, pg_graphql), or use the secret key or the direct database connection.',
      )
    : null;
}

const PUBLISHABLE_KEY_PREFIX = 'sb_publishable_';
const SECRET_KEY_PREFIX = 'sb_secret_';

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function publishableKeyError(
  key: string,
): SupabaseConnectionError | null {
  return key.startsWith(PUBLISHABLE_KEY_PREFIX) || jwtRole(key) === 'anon'
    ? new SupabaseConnectionError(
        'rejected-key',
        `This looks like the publishable (anon) key. Paste the secret key (sb_secret_..., or legacy service_role key) from ${KEY_SOURCES.secret}.`,
      )
    : null;
}

export function secretKeyError(key: string): SupabaseConnectionError | null {
  return key.startsWith(SECRET_KEY_PREFIX) || jwtRole(key) === 'service_role'
    ? new SupabaseConnectionError(
        'rejected-key',
        `This looks like the secret (service_role) key. Paste the publishable key (sb_publishable_..., or legacy anon key) from ${KEY_SOURCES.publishable}.`,
      )
    : null;
}

export const SUPABASE_TIMEOUT_MS = 15000;

interface NetworkFailure {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  cause?: NetworkFailure;
}

function networkCause(error: unknown): string {
  const failure = (error ?? {}) as NetworkFailure;
  if (failure.name === 'TimeoutError') {
    return `no answer after ${SUPABASE_TIMEOUT_MS / 1000} seconds`;
  }
  const cause = failure.cause ?? {};
  for (const reason of [cause.code, cause.message, failure.message]) {
    if (typeof reason === 'string' && reason !== '') {
      return reason;
    }
  }
  return 'network error';
}

export function unreachableUrlError(
  url: string,
  error: unknown,
): SupabaseConnectionError {
  return new SupabaseConnectionError(
    'unreachable-url',
    `Could not reach ${new URL(url).origin} (${networkCause(error)}). Check the project URL under ${KEY_SOURCES.publishable}.`,
  );
}
