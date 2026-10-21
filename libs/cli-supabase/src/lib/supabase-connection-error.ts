export type SupabaseConnectionProblem = 'rejected-key' | 'graphql-disabled';

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

export function rejectedKeyError(
  keyLabel: string,
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
    `Supabase refused the ${keyLabel} (${status}${message ? `: ${message}` : ''}). Copy it again from the Supabase dashboard: Project Settings, API.`,
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
        'The pg_graphql extension is not enabled on this project. Enable it in the Supabase dashboard (Database, Extensions, pg_graphql), or use the service role key or the direct database connection.',
      )
    : null;
}
