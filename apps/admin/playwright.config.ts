import { defineConfig } from "@playwright/test"

const port = 3101

// e2e runs the panel on its own port and build directory, next to a running
// start.sh. The API is mocked in the browser (MSW), so API_URL leads nowhere.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      ADMIN_BOT_USERNAME: "hisob24_admin_bot",
      API_URL: "http://127.0.0.1:9",
    },
  },
})
