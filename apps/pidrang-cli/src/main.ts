#!/usr/bin/env node
import {
  GeneratedFile,
  RESOURCE_ROUTES_SNIPPET,
  SIGN_IN_PATH_SNIPPET,
  generatePagesBundle,
  generateResourcesFile,
  runInitWizard,
} from '@pidrang/cli';
import { supabaseSchemaProviderDefinition } from '@pidrang/cli-supabase';
import { findChangedFiles } from './find-changed-files';
import { findStaleSignInFiles } from './find-stale-sign-in-files';
import { writeGeneratedFile } from './write-generated-file';

const PROVIDE_PIDRANG_SNIPPET = `providePidrang({
  dataProvider: ...,
  resources: [...resources],
})`;

async function runInit(): Promise<void> {
  const plan = await runInitWizard([supabaseSchemaProviderDefinition]);
  const root = process.cwd();

  const resourcesResult = await writeGeneratedFile(root, {
    path: 'src/app/resources.ts',
    content: generateResourcesFile(plan),
  });
  console.log(
    `${resourcesResult === 'written' ? 'Wrote' : 'Skipped (already exists)'} src/app/resources.ts`,
  );

  const skipped: GeneratedFile[] = [];
  for (const file of generatePagesBundle()) {
    const result = await writeGeneratedFile(root, file);
    if (result === 'skipped') {
      skipped.push(file);
    }
    console.log(
      `${result === 'written' ? 'Wrote' : 'Skipped (already exists)'} ${file.path}`,
    );
  }
  const changed = await findChangedFiles(root, skipped);
  if (changed.length > 0) {
    console.log(
      `\nThese existing files differ from what this pidrang version generates and were kept as they are: ${changed.join(', ')}. To get the current version, delete src/app/pages and src/app/pidrang together (the pages need the matching helpers) and run pidrang init again; otherwise keep them all as they are.`,
    );
  }

  console.log(
    '\nAdd these routes to your app.routes.ts, above any other :resource-like route:\n',
  );
  console.log(RESOURCE_ROUTES_SNIPPET);
  console.log('Register the generated resources in your app.config.ts:\n');
  console.log(PROVIDE_PIDRANG_SNIPPET);
  console.log(
    '\nWhen a write needs a signed-in user, the pages say so in plain text. To turn that into a link to your sign-in page, add this provider to your app.config.ts and replace /your-sign-in-route with the path of that page inside your app:\n',
  );
  console.log(SIGN_IN_PATH_SNIPPET);
  const stale = await findStaleSignInFiles(root, skipped);
  if (stale.length > 0) {
    console.log(
      `\n${stale.join(', ')} come from an older pidrang: an old page keeps its link to /login whatever you provide, and new pages with an old src/app/pidrang/index.ts do not compile. Delete src/app/pages and src/app/pidrang together and run pidrang init again.`,
    );
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'init') {
    console.log('Usage: pidrang init');
    process.exitCode = 1;
    return;
  }
  await runInit();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
