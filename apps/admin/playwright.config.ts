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
    // Dates made from timestamps show the browser's day: the same one on any machine.
    timezoneId: "Asia/Tashkent",
  },
  projects: [
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    // The command, its port and its env live in package.json's e2e:server, so
    // a server started by hand for a session (pnpm --filter @hisob24/admin
    // e2e:server) is the one Playwright would start, and it is reused.
    command: "pnpm run e2e:server",
    url: `http://localhost:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
