# adapter-coexistence

Private test project, never published. Its spec renders the `ResourceTable` and `ResourceForm` of `@pidrang/material` and `@pidrang/tailwind` side by side in one component, so the two adapters can be imported together and each selector renders its own adapter.

`@pidrang/material` and `@pidrang/tailwind` depend on `@pidrang/core` only and never on each other, so this check lives in its own project instead of either library. Run it with `nx test adapter-coexistence`.
