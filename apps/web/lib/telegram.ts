import { useSyncExternalStore } from "react"
import type { TelegramWebApp } from "@/types/telegram"

// waitForWebApp resolves with Telegram's WebApp once it holds initData,
// checking every step ms for tries more times (about a second), as
// telegram-web-app.js may still be loading; null means the app is not
// open inside Telegram.
export async function waitForWebApp({ tries = 10, step = 100 } = {}): Promise<TelegramWebApp | null> {
  for (let i = 0; ; i++) {
    const webApp = window.Telegram?.WebApp
    if (webApp?.initData) return webApp
    if (i === tries) return null
    await new Promise((resolve) => setTimeout(resolve, step))
  }
}

let miniApp: TelegramWebApp | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// setMiniApp records the WebApp TelegramSync found, or null to forget it.
export function setMiniApp(webApp: TelegramWebApp | null) {
  miniApp = webApp
  listeners.forEach((listener) => listener())
}

// useMiniApp is Telegram's WebApp once TelegramSync has found it, null in a
// browser tab.
export function useMiniApp(): TelegramWebApp | null {
  return useSyncExternalStore(
    subscribe,
    () => miniApp,
    () => null,
  )
}

// chromeColors are the app's own colors for Telegram's chrome around the
// Mini App, by scheme: the header over its top, the background behind it
// and the bar under it are the top, the base and the bottom of the ambient
// light (app/globals.css; the dark's slanted gradient as drawn at the
// middle of a phone's top and bottom edges), so the app keeps its colors
// inside Telegram (docs: 2026-10-16 liquid glass, decision 2; glass v2).
export const chromeColors = {
  light: { header: "#F7F8F9", background: "#F1F2F4", bottomBar: "#E5E7EB" },
  dark: { header: "#1C1D21", background: "#0F1013", bottomBar: "#14161A" },
} as const
