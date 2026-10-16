"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect } from "react"
import { isRootPath, sectionRootOf } from "@/lib/nav"
import { chromeColors, setMiniApp, useMiniApp, waitForWebApp } from "@/lib/telegram"
import { moving } from "@/lib/moves"
import type { TelegramWebApp } from "@/types/telegram"

// The pages outside the app's shell: there is nothing to go back to there.
const SHELL_LESS = ["/login", "/select-company", "/expired"]

// canGoBack tells whether there is a page behind this one. The Navigation
// API knows, where the browser has it (back at the first page, the history
// stays longer than one entry); elsewhere a longer history is taken for it.
function canGoBack(): boolean {
  const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation
  return navigation?.canGoBack ?? window.history.length > 1
}

// TelegramSync fits the app to Telegram when it runs as a Mini App: it
// tells Telegram the app is ready, opens it to full height, keeps its
// vertical swipes from folding the app, marks <html>
// with data-telegram (globals.css keeps the app's own colors there),
// follows Telegram's light or dark scheme and paints Telegram's own chrome
// in the app's colors of the scheme. Inside a
// section (a record, a form, the profile) it shows Telegram's own back
// button, beside the page's: back where the app came from, or to the
// section's own page when there is nothing behind.
// onPhone tells a phone's Telegram (iOS, Android, Android X) from the
// desktop and web clients by the platform name telegram-web-app.js reports.
const onPhone = (platform: string) => platform === "ios" || platform.startsWith("android")

// paintChrome paints Telegram's header, the background behind the app and
// the bar under it in the app's own colors for the scheme, as far as the
// client knows how: a #RRGGBB header from Bot API 6.9, the background from
// 6.1, the bottom bar from 7.10 (a method the client is too old for throws
// or warns).
function paintChrome(webApp: TelegramWebApp) {
  const colors = chromeColors[webApp.colorScheme]
  const knows = (version: string) => webApp.isVersionAtLeast?.(version) ?? false
  if (knows("6.9")) webApp.setHeaderColor?.(colors.header)
  if (knows("6.1")) webApp.setBackgroundColor?.(colors.background)
  if (knows("7.10")) webApp.setBottomBarColor?.(colors.bottomBar)
}

export function TelegramSync() {
  const { setTheme } = useTheme()
  const webApp = useMiniApp()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}
    waitForWebApp().then((webApp) => {
      if (cancelled || !webApp) return
      setMiniApp(webApp)
      webApp.ready()
      webApp.expand()
      // A vertical swipe would fold or close the Mini App: on the board a
      // card is dragged up and down, so the swipe is turned off where the
      // client knows the switch (Bot API 7.7+).
      webApp.disableVerticalSwipes?.()
      // Full screen on a phone: Telegram's header goes and the app takes the
      // whole screen; the status bar and Telegram's own controls then lie
      // over its top, which --safe-top keeps clear (globals.css). On a
      // desktop client full screen would be the whole window, and a client
      // older than Bot API 8.0 throws at the request.
      if (onPhone(webApp.platform) && webApp.isVersionAtLeast?.("8.0")) webApp.requestFullscreen?.()
      document.documentElement.dataset.telegram = ""
      const follow = () => {
        setTheme(webApp.colorScheme)
        paintChrome(webApp)
      }
      follow()
      webApp.onEvent("themeChanged", follow)
      unsubscribe = () => webApp.offEvent("themeChanged", follow)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setTheme])

  useEffect(() => {
    const back = webApp?.BackButton
    if (!back) return
    if (isRootPath(pathname) || SHELL_LESS.includes(pathname)) {
      back.hide()
      return
    }
    const goBack = () => moving("back", () => (canGoBack() ? router.back() : router.push(sectionRootOf(pathname))))
    back.onClick(goBack)
    back.show()
    return () => back.offClick(goBack)
  }, [webApp, pathname, router])

  return null
}
