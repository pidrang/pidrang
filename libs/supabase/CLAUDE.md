# libs/supabase — CLAUDE.md

Package-specific rules for `@pidrang/supabase`. The org-wide conventions in the root `CLAUDE.md` apply here too; this file only covers what's specific to this package.

## Dependency boundary

Depends on `@pidrang/core` and `@supabase/supabase-js` only — never on `@pidrang/material` or any other UI package, and never on `apps/demo`. It has no Angular DI of its own: `provideSupabaseDataProvider({ client })` and `provideSupabaseAuthProvider({ client })` return plain `DataProvider`/`AuthProvider` objects, not Angular providers. Wiring those objects into Angular's DI (via core's `providePidrang`) is the consuming app's job, not this package's.

## RLS is the only access control — this package has none

`SupabaseDataProvider` and `SupabaseAuthProvider` perform no authorization themselves; every access guarantee comes from the Row Level Security policies on the integrator's own Supabase project (see the root README's Architecture section). Never add permission checks, role logic, or query filtering here to "help" — that would give integrators a false sense of security layered on top of whatever RLS they actually have configured, and would diverge from what the RLS policies say is allowed.

## Every table is assumed to have an `id` primary key column

`getOne`, `update`, and `delete` all filter with `.eq('id', params.id)` — there's no support for a different or composite primary key. This is an intentional scope limit (see ROADMAP.md), not an oversight; if a task needs a different key, that's a real API change to discuss first; don't route around it locally in one method.

## Error normalization

`toError()` converts a Supabase error (anything with a `message`) into a plain `Error`, shared between `SupabaseDataProvider` and `SupabaseAuthProvider`. Any new method that can fail should throw through `toError()` too, so `DataProvider`/`AuthProvider` consumers in `@pidrang/core` always see a plain `Error`, never a raw `PostgrestError`/`AuthError`.

## The `as never` casts in create/update are intentional

`SupabaseDataProvider.create`/`update` cast `params.data` to `never` before calling `insert`/`update`. Without a typed Supabase `Database` schema, `postgrest-js` can't unify its expected row type with this package's unconstrained generic `T`. Don't try to "fix" this with a wider cast or `any` — `never` is the narrowest cast that still compiles, and removing it properly means adding real `Database` typing support, which is a bigger change to scope separately.
