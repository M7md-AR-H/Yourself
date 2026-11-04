import { defineConfig } from '@playwright/test';

// POCO F5 (non-Pro) in Chrome: ~393×873 CSS px, DPR 2.75.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 393, height: 873 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'poco-f5-light', use: { colorScheme: 'light' } },
    { name: 'poco-f5-dark', use: { colorScheme: 'dark' } },
    { name: 'small-360', use: { viewport: { width: 360, height: 740 } } },
  ],
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
