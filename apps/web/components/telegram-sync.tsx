"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"
import { setMiniApp, waitForWebApp } from "@/lib/telegram"

// TelegramSync fits the app to Telegram when it runs as a Mini App: it
// tells Telegram the app is ready, opens it to full height, keeps its
// vertical swipes from folding the app, marks <html>
// with data-telegram (globals.css then takes the colors from Telegram's
// themeParams) and follows Telegram's light or dark scheme.
// onPhone tells a phone's Telegram (iOS, Android, Android X) from the
// desktop and web clients by the platform name telegram-web-app.js reports.
const onPhone = (platform: string) => platform === "ios" || platform.startsWith("android")

export function TelegramSync() {
  const { setTheme } = useTheme()

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
      const follow = () => setTheme(webApp.colorScheme)
      follow()
      webApp.onEvent("themeChanged", follow)
      unsubscribe = () => webApp.offEvent("themeChanged", follow)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setTheme])

  return null
}
