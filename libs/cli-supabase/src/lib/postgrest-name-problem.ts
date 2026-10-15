const POSTGREST_SYNTAX = /[.,()"]|->/;

export function postgrestNameProblem(name: string): string | null {
  return POSTGREST_SYNTAX.test(name)
    ? 'a name PostgREST would read as a path, a list or a quote'
    : null;
}
