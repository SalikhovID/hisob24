"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"
import { setMiniApp, waitForWebApp } from "@/lib/telegram"

// TelegramSync fits the app to Telegram when it runs as a Mini App: it
// tells Telegram the app is ready, opens it to full height, marks <html>
// with data-telegram (globals.css then takes the colors from Telegram's
// themeParams) and follows Telegram's light or dark scheme.
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
