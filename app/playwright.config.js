import { defineConfig, devices } from '@playwright/test';

const appPort = Number(process.env.E2E_APP_PORT || 43127);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${appPort}`;
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_CMD
  || `cmd /c npm run dev -- --host 127.0.0.1 --port ${appPort} --strictPort`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: webServerCommand,
    port: appPort,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
