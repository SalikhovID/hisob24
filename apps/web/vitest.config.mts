import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".next-e2e/**", "e2e/**"],
    // Dates render in the app's own time zone in every test run.
    env: { TZ: "Asia/Tashkent" },
    // The page tests type through whole forms; under `pnpm -r test` three
    // suites share the CPU, and the default five seconds ran out.
    testTimeout: 15_000,
  },
})
