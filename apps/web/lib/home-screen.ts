"use client"

import { useEffect, useState } from "react"
import type { HomeScreenStatus } from "@/types/telegram"
import { useMiniApp } from "./telegram"
import { useKept } from "./use-kept"

const HIDDEN = "home_screen_offer_hidden"

export interface HomeScreenOffer {
  // offered: the Mini App may be put on the home screen, is not there yet,
  // and the member has not put the offer away.
  offered: boolean
  add: () => void
  dismiss: () => void
}

// useHomeScreenOffer is the offer to put the Mini App on the phone's home
// screen (Bot API 8.0+), as the prototype's banner and profile card make
// it: only inside a Telegram that can, while the app is not there; once
// Telegram says it was added, or the member puts the offer away (kept in
// the browser), it goes.
export function useHomeScreenOffer(): HomeScreenOffer {
  const webApp = useMiniApp()
  const [hidden, keepHidden] = useKept(HIDDEN)
  const [status, setStatus] = useState<HomeScreenStatus | null>(null)
  const supported =
    webApp !== null && webApp.addToHomeScreen !== undefined && webApp.checkHomeScreenStatus !== undefined && (webApp.isVersionAtLeast?.("8.0") ?? false)

  useEffect(() => {
    if (!supported || !webApp) return
    webApp.checkHomeScreenStatus?.((next) => setStatus(next))
    const added = () => setStatus("added")
    webApp.onEvent("homeScreenAdded", added)
    return () => webApp.offEvent("homeScreenAdded", added)
  }, [supported, webApp])

  return {
    offered: supported && hidden === null && (status === "missed" || status === "unknown"),
    add: () => webApp?.addToHomeScreen?.(),
    dismiss: () => keepHidden("1"),
  }
}
