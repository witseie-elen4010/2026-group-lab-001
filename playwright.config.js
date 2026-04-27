const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/E2E',
  testMatch: '**/*.js',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node src/app.js',
    env: {
      ...process.env,
      PORT: '4173',
      SESSION_SECRET: process.env.SESSION_SECRET || 'playwright-session-secret'
    },
    reuseExistingServer: !process.env.CI && !process.env.NODE_V8_COVERAGE,
    timeout: 120000,
    url: 'http://127.0.0.1:4173/login'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
