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
  // isVersionAtLeast says whether the client's Bot API is at least version
  // (telegram-web-app.js throws at a method the client is too old for).
  isVersionAtLeast?: (version: string) => boolean
  // requestFullscreen opens the Mini App over the whole screen, Telegram's
  // header gone (Bot API 8.0+); exitFullscreen gives the header back.
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  isFullscreen?: boolean
  // addToHomeScreen asks to put the Mini App on the phone's home screen
  // (Bot API 8.0+); checkHomeScreenStatus says whether it is there, may be
  // put there, or cannot be.
  addToHomeScreen?: () => void
  checkHomeScreenStatus?: (callback: (status: HomeScreenStatus) => void) => void
  // setHeaderColor, setBackgroundColor and setBottomBarColor paint
  // Telegram's own chrome around the Mini App: its header (a #RRGGBB color
  // from Bot API 6.9), the background behind the app (6.1) and the bar under
  // it (7.10).
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  // BackButton is Telegram's own back button in the Mini App's header or
  // floating controls (Bot API 6.1+).
  BackButton?: TelegramBackButton
  onEvent: (event: TelegramEvent, handler: () => void) => void
  offEvent: (event: TelegramEvent, handler: () => void) => void
}

export type HomeScreenStatus = "unsupported" | "unknown" | "added" | "missed"

// The events the app listens to: the chat's theme changed, the Mini App was
// put on the home screen.
export type TelegramEvent = "themeChanged" | "homeScreenAdded"

export interface TelegramBackButton {
  isVisible: boolean
  show: () => void
  hide: () => void
  onClick: (handler: () => void) => void
  offClick: (handler: () => void) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

