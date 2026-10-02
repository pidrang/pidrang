import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

import { gateDirectory } from './paths.mjs';

const SUITES = {
  'consumer-material': {
    port: 4320,
    command: `node tools/release-gate/serve-spa.mjs ${join(gateDirectory, 'consumers/material/site')} 4320`,
  },
  'consumer-tailwind': {
    port: 4321,
    command: `node tools/release-gate/serve-spa.mjs ${join(gateDirectory, 'consumers/tailwind/site')} 4321`,
  },
  'demo-material': {
    port: 4310,
    command:
      'pnpm exec nx run demo-material:serve:local --port 4310 --host 127.0.0.1',
  },
  'demo-tailwind': {
    port: 4311,
    command:
      'pnpm exec nx run demo-tailwind:serve:local --port 4311 --host 127.0.0.1',
  },
} as const;

type Suite = keyof typeof SUITES;

const selected = (process.env['PIDRANG_GATE_SUITES']
  ?.split(',')
  .filter(Boolean) ?? []) as Suite[];
if (selected.length === 0) {
  selected.push(...(Object.keys(SUITES) as Suite[]));
}
for (const suite of selected) {
  if (!(suite in SUITES)) {
    throw new Error(`unknown release gate suite ${suite}`);
  }
}

export default defineConfig({
  testDir: './e2e',
  outputDir: join(gateDirectory, 'playwright/results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: join(gateDirectory, 'playwright/report'), open: 'never' },
    ],
    ['json', { outputFile: join(gateDirectory, 'playwright/results.json') }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: selected.map((suite) => ({
    name: suite,
    testMatch: suite.startsWith('demo-') ? 'demo.spec.ts' : `${suite}.spec.ts`,
    use: { baseURL: `http://127.0.0.1:${SUITES[suite].port}` },
  })),
  webServer: selected.map((suite) => ({
    command: SUITES[suite].command,
    url: `http://127.0.0.1:${SUITES[suite].port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    cwd: join(import.meta.dirname, '../..'),
    stdout: 'pipe',
    stderr: 'pipe',
  })),
});
