import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"
import { setMiniApp } from "./lib/telegram"
import { resetDb } from "./mocks/data"
import { setLocation } from "./test/navigation"
import { server } from "./test/server"

vi.mock("next/navigation", () => import("./test/navigation"))

// Some tests (proxy.ts) run in the node environment, without a window.
const browser = typeof window !== "undefined"

// jsdom has no matchMedia; next-themes and sonner ask it for the system theme.
if (browser) {
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
  // input-otp looks for password-manager badges with elementFromPoint.
  document.elementFromPoint = () => null
}

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
beforeEach(() => {
  resetDb()
  setLocation("/")
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
  setMiniApp(null)
  if (browser) {
    delete window.Telegram
    document.documentElement.removeAttribute("data-telegram")
    document.documentElement.removeAttribute("class")
    document.documentElement.removeAttribute("style")
    localStorage.clear()
  }
})
afterAll(() => server.close())
