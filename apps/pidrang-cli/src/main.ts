#!/usr/bin/env node
import {
  RESOURCE_ROUTES_SNIPPET,
  generatePagesBundle,
  generateResourcesFile,
  runInitWizard,
} from '@pidrang/cli';
import { supabaseSchemaProviderDefinition } from '@pidrang/cli-supabase';
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

  for (const file of generatePagesBundle()) {
    const result = await writeGeneratedFile(root, file);
    console.log(
      `${result === 'written' ? 'Wrote' : 'Skipped (already exists)'} ${file.path}`,
    );
  }

  console.log(
    '\nAdd these routes to your app.routes.ts, above any other :resource-like route:\n',
  );
  console.log(RESOURCE_ROUTES_SNIPPET);
  console.log('Register the generated resources in your app.config.ts:\n');
  console.log(PROVIDE_PIDRANG_SNIPPET);
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
