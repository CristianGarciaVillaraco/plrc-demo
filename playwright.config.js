const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    locale: 'es-ES',
    viewport: { width: 390, height: 844 },  // iPhone 14 — ensures mobile layout (FAB, tabs visible)
  },
  webServer: {
    command: 'node dev-server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
  },
});
