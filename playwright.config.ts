import { defineConfig } from "@playwright/test";

const HEADLESS = true;

export default defineConfig({
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4200/paste-perfect/",
    headless: process.env.CI ? true : HEADLESS, // always headless in CI
    viewport: { width: 1280, height: 720 }, // consistent resolution for screenshots
    deviceScaleFactor: 1, // no retina / high-DPI differences
    userAgent: "ScreenshotTestAgent/1.0",
  },
  testDir: "e2e-tests",
  snapshotPathTemplate: "{testDir}/snapshots/{testFilePath}/{arg}{ext}",
  webServer: {
    command: "npm run serve",
    port: 4200,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
