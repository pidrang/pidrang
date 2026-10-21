#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { confirmPackageInstall } from '@pidrang/cli';
import { supabaseSchemaProviderDefinition } from '@pidrang/cli-supabase';
import { spawnCommand } from './install-packages';
import { EXIT_FAILED, runCli } from './run-cli';

function cliVersion(): string {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { version: string };
  return manifest.version;
}

function watchInterrupt() {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort);
  return {
    signal: controller.signal,
    dispose: () => process.off('SIGINT', abort),
  };
}

runCli(process.argv.slice(2), {
  providers: [supabaseSchemaProviderDefinition],
  cwd: process.cwd(),
  env: process.env,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  watchInterrupt,
  interactive: process.stdin.isTTY === true,
  nodeVersion: process.versions.node,
  version: cliVersion(),
  confirmInstall: confirmPackageInstall,
  runCommand: spawnCommand(process.cwd()),
}).then(
  (status) => {
    process.exitCode = status;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = EXIT_FAILED;
  },
);
