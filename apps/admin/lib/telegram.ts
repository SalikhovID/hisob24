import { useSyncExternalStore } from "react"
import type { TelegramWebApp } from "@/types/telegram"

// waitForWebApp resolves with Telegram's WebApp once it holds initData,
// checking every step ms for tries more times (about a second), as
// telegram-web-app.js may still be loading; null means the panel is not
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
