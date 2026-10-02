// The part of telegram-web-app.js the panel uses.
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
  onEvent: (event: "themeChanged", handler: () => void) => void
  offEvent: (event: "themeChanged", handler: () => void) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

