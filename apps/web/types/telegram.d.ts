// The part of telegram-web-app.js the user app uses.
export interface TelegramWebAppUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: TelegramWebAppUser }
  colorScheme: "light" | "dark"
  themeParams: Record<string, string | undefined>
  platform: string
  ready: () => void
  expand: () => void
  close: () => void
  // requestContact asks the user to share their phone with the bot (Bot API
  // 6.9+); the callback says whether they did.
  requestContact?: (callback: (shared: boolean) => void) => void
  // disableVerticalSwipes keeps a vertical swipe from folding or closing the
  // Mini App (Bot API 7.7+): a drag on the board stays a drag.
  disableVerticalSwipes?: () => void
  onEvent: (event: "themeChanged", handler: () => void) => void
  offEvent: (event: "themeChanged", handler: () => void) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

