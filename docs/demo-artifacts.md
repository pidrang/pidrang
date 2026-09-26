# Demo artifacts

The `Demo artifacts` workflow builds both demo applications for GitHub Pages and publishes them as one immutable artifact. Deploying that artifact to the public site is done by the `pidrang.github.io` repository, which serves `https://pidrang.dev/`.

## Building an artifact

The workflow also runs on pull requests that touch the demos, the libraries or these tools, to check that the Pages build keeps working; those runs upload nothing. Run the workflow manually from the Actions tab (`Demo artifacts`, Run workflow). Leave `ref` empty to build the branch you run it from, or pass a branch, tag or commit to build exactly that source. The workflow:

1. builds `demo-material` and `demo-tailwind` with their `pages` configuration, which sets the base path (`/demo-material/`, `/demo-tailwind/`) and replaces the environment with `environment.pages.ts` so the links between the demos use the public URLs,
2. assembles the artifact and writes `metadata.json`,
3. refuses to continue if the output contains a service role key, a `sb_secret_` key, a database connection string or a JWT whose role is not `anon`,
4. serves the artifact with a static server that behaves like GitHub Pages and runs the Playwright checks against it,
5. uploads the artifact as `demos-<commit sha>`, kept for 30 days.

Only the public Supabase URL and the publishable key are in the artifact. Both are already in the repository, and Row Level Security on the demo project is what limits what they can do.

## Layout

```text
demos/
  metadata.json
  404.html
  demo-material/
  demo-tailwind/
```

`metadata.json` records where the artifact comes from:

| Field                                              | Meaning                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `schema`                                           | Version of this file format, currently `1`.                                                             |
| `source.repository`, `source.commit`, `source.ref` | Repository, exact commit and ref that were built.                                                       |
| `source.dirty`                                     | `true` when the working tree had uncommitted changes. An artifact built by the workflow is never dirty. |
| `source.workflow`, `source.runId`                  | The workflow and run that produced it.                                                                  |
| `builtAt`                                          | Build time, ISO 8601.                                                                                   |
| `origin`, `demos`                                  | Public origin and the path and URL of each demo.                                                        |
| `packages`                                         | Version of each `@pidrang/*` library in the source.                                                     |

## Deep links

GitHub Pages serves only static files and uses the `404.html` at the root of the site for any unknown path. A demo cannot have its own. The artifact therefore ships one generic `404.html` that must be copied to the root of the site.

For a path such as `/demo-material/products/create?x=1#top`, it redirects to `/demo-material/?/products/create&x=1#top`. A small script in each demo's `index.html` then restores the original path, query string and hash before Angular starts. Any other unknown path keeps a plain "Page not found" page.

## Deploying it from `pidrang.github.io`

The site workflow should, for an explicitly chosen run:

1. download the artifact with `gh run download <run-id> --repo pidrang/pidrang --name demos-<sha>`,
2. check with `gh run view <run-id> --repo pidrang/pidrang --json workflowName,event,conclusion` that the run is the `Demo artifacts` workflow, was started manually (`workflow_dispatch`) and succeeded, that `source.commit` in `metadata.json` equals the `<sha>` in the artifact name, and that `source.dirty` is `false`,
3. copy `demo-material/`, `demo-tailwind/` and `404.html` into the site, next to the existing landing page files,
4. keep `metadata.json` at the site root so the deployed source stays traceable.

To roll back, deploy the previous run the same way, or revert the deployment commit in the site repository. Artifacts expire after 30 days, so a revert is the way back for older deployments.

## Running the checks locally

```bash
node tools/demo-artifacts/build.mjs
pnpm exec playwright install chromium
pnpm exec playwright test -c tools/demo-artifacts/playwright.config.mts
```

To use a Chromium you already have instead of the one Playwright downloads, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path.

The public origin is `https://pidrang.dev`, set in `tools/demo-artifacts/shared.mjs` and in each demo's `environment.pages.ts`. Change all three places if the domain changes.
