const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/playwright",
  use: {
    headless: true,
    baseURL: "http://localhost:8765",
  },
  webServer: {
    command: "python3 -m http.server 8765",
    port: 8765,
    reuseExistingServer: true,
  },
});
