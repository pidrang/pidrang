#!/usr/bin/env node
import { supabaseSchemaProviderDefinition } from '@pidrang/cli-supabase';
import { EXIT_FAILED, runCli } from './run-cli';

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
}).then(
  (status) => {
    process.exitCode = status;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = EXIT_FAILED;
  },
);
