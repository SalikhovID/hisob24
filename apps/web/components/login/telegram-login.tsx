"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect } from "react"
import { api, call } from "@/lib/api"
import { setAccessToken } from "@/lib/session"
import type { TelegramWebApp } from "@/types/telegram"

// TelegramLogin signs in the user who opened the Mini App, with no code: the
// user bot signed initData, and the account shared a user's phone with it.
// onFallback hands over to the SMS form, saying why.
export function TelegramLogin({ webApp }: { webApp: TelegramWebApp; onFallback: (notice: string) => void }) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    call(api.POST("/app/auth/telegram", { body: { initData: webApp.initData } })).then((tokens) => {
      if (cancelled) return
      setAccessToken(tokens.access_token)
      router.replace("/")
    })
    return () => {
      cancelled = true
    }
  }, [webApp, router])

  return (
    <Centered>
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Telegram orqali kirilmoqda…</p>
    </Centered>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">{children}</div>
    </main>
  )
}
