import { defineConfig, devices } from '@playwright/test';

const port = 4300;

export default defineConfig({
  testDir: './e2e',
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: {
      executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'],
    },
  },
  webServer: {
    command: `node tools/demo-artifacts/serve-pages-like.mjs dist/pages ${port}`,
    cwd: '../..',
    url: `http://127.0.0.1:${port}/demo-material/`,
    reuseExistingServer: !process.env['CI'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
