import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  timeout: 30_000,
  fullyParallel: true,
  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:4173/examples/web/',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
});
