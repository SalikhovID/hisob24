import { afterEach, beforeEach, expect, test, vi } from "vitest"
import type { TelegramWebApp } from "@/types/telegram"
import { waitForWebApp } from "./telegram"

function fakeWebApp(initData: string) {
  return { initData } as TelegramWebApp
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test("waitForWebApp finds a WebApp that is already there", async () => {
  window.Telegram = { WebApp: fakeWebApp("user=%7B%22id%22%3A42%7D") }

  await expect(waitForWebApp()).resolves.toBe(window.Telegram.WebApp)
})

test("waitForWebApp waits while the script loads", async () => {
  const found = waitForWebApp()
  await vi.advanceTimersByTimeAsync(300)
  window.Telegram = { WebApp: fakeWebApp("user=%7B%22id%22%3A42%7D") }
  await vi.advanceTimersByTimeAsync(100)

  await expect(found).resolves.toBe(window.Telegram.WebApp)
})

test("waitForWebApp gives up after a second", async () => {
  const found = waitForWebApp()
  await vi.advanceTimersByTimeAsync(1000)

  await expect(found).resolves.toBeNull()
})

test("waitForWebApp ignores a WebApp without initData: the panel in a browser tab", async () => {
  window.Telegram = { WebApp: fakeWebApp("") }
  const found = waitForWebApp()
  await vi.advanceTimersByTimeAsync(1000)

  await expect(found).resolves.toBeNull()
})
