import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"
import { resetDb } from "./mocks/data"
import { setLocation } from "./test/navigation"
import { server } from "./test/server"

vi.mock("next/navigation", () => import("./test/navigation"))

// jsdom has no matchMedia; next-themes and sonner ask it for the system theme.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
beforeEach(() => {
  resetDb()
  setLocation("/")
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
  delete window.Telegram
})
afterAll(() => server.close())
