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
