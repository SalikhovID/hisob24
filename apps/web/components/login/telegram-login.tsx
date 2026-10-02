"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { api, ApiError, call } from "@/lib/api"
import { setAccessToken } from "@/lib/session"
import type { TelegramWebApp } from "@/types/telegram"

type Stage = { kind: "checking" } | { kind: "no_access"; message: string }

// TelegramLogin signs in the user who opened the Mini App, with no code: the
// user bot signed initData, and the account shared a user's phone with it.
// onFallback hands over to the SMS form, saying why.
export function TelegramLogin({ webApp }: { webApp: TelegramWebApp; onFallback: (notice: string) => void }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: "checking" })

  useEffect(() => {
    let cancelled = false
    call(api.POST("/app/auth/telegram", { body: { initData: webApp.initData } })).then(
      (tokens) => {
        if (cancelled) return
        setAccessToken(tokens.access_token)
        router.replace(tokens.company_id === null ? "/select-company" : "/")
      },
      (error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.code === "no_access") setStage({ kind: "no_access", message: error.message })
      },
    )
    return () => {
      cancelled = true
    }
  }, [webApp, router])

  if (stage.kind === "no_access") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Kirish huquqi yo&apos;q</h1>
        <p className="text-sm text-muted-foreground">{stage.message}</p>
        <Button className="mt-2" onClick={() => webApp.close()}>
          Yopish
        </Button>
      </Centered>
    )
  }
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
