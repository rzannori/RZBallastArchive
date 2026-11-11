// Test end-to-end: l'app viene servita in una sottocartella, come su GitHub Pages
// (https://<utente>.github.io/<repo>/), per verificare i percorsi relativi.
const { defineConfig, devices } = require('@playwright/test');
const PORT = 8173;
module.exports = defineConfig({
  testDir: 'tests',
  timeout: 45000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: `http://localhost:${PORT}/RZBallastArchive/`,
    acceptDownloads: true,
    serviceWorkers: 'allow',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: `python3 tests/serve.py ${PORT}`,
    url: `http://localhost:${PORT}/RZBallastArchive/index.html`,
    reuseExistingServer: false,
  },
});
