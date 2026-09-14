import { defineConfig, devices } from '@playwright/test';

const appPort = Number(process.env.E2E_APP_PORT || 43127);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${appPort}`;
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_CMD
  || `npm run dev -- --host 127.0.0.1 --port ${appPort} --strictPort`;
const webServer = process.env.E2E_BASE_URL ? undefined : {
  command: webServerCommand,
  port: appPort,
  reuseExistingServer: false,
  timeout: 60_000,
  env: {
    ...process.env,
    VITE_RETURN_API_URL: process.env.VITE_RETURN_API_URL || 'https://return-api.xenovoya.com',
    VITE_PLAUSIBLE_HOST: process.env.VITE_PLAUSIBLE_HOST || 'https://plausible.racerverse.com',
    VITE_PLAUSIBLE_DOMAIN: process.env.VITE_PLAUSIBLE_DOMAIN || 'play.xenovoya.com',
    VITE_APP_ENV: process.env.VITE_APP_ENV || 'test',
    VITE_RELEASE_SHA: process.env.VITE_RELEASE_SHA || 'e2e-release',
    VITE_ANALYTICS_SOURCE: process.env.VITE_ANALYTICS_SOURCE || 'synthetic',
  },
};

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS || (process.env.CI ? 2 : 1)),
  retries: Number(process.env.E2E_RETRIES || 1),
  expect: {
    timeout: 10_000,
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /ux-touch\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox-desktop',
      testIgnore: [/return-sync\.spec\.js/, /ux-input\.spec\.js/, /ux-touch\.spec\.js/],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-desktop',
      testIgnore: [/return-sync\.spec\.js/, /ux-input\.spec\.js/, /ux-touch\.spec\.js/],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'pixel-7',
      testIgnore: [/return-sync\.spec\.js/, /ux-assistive\.spec\.js/, /ux-input\.spec\.js/],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone-13',
      testIgnore: [/return-sync\.spec\.js/, /ux-assistive\.spec\.js/, /ux-input\.spec\.js/],
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer,
});
