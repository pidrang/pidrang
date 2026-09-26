// Default Supabase CLI local dev keys — same for every contributor running
// `supabase start` against the `pidrang/supabase` repo's unmodified config.toml.
// Only reachable at 127.0.0.1, requires the local Supabase containers to be running.
export const environment = {
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseAnonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  tailwindDemoUrl: 'http://localhost:4201',
  demoAccount: null as { email: string; password: string } | null,
};
