"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import { api, call } from "@/lib/api"
import { waitForWebApp } from "@/lib/telegram"
import { OtpLogin } from "./otp-login"

type Stage = { kind: "code" } | { kind: "checking" }

// LoginScreen signs an admin in: inside Telegram by itself with initData
// (no code, no extra step), in a browser with the bot's code.
export function LoginScreen({ botUsername }: { botUsername: string }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: "code" })

  useEffect(() => {
    let cancelled = false
    waitForWebApp().then(async (webApp) => {
      if (cancelled || !webApp) return
      setStage({ kind: "checking" })
      await call(api.POST("/admin/auth/telegram", { body: { initData: webApp.initData } }))
      if (!cancelled) router.replace("/companies")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  if (stage.kind === "checking") {
    return (
      <Centered>
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Telegram orqali kirilmoqda…</p>
      </Centered>
    )
  }
  return <OtpLogin botUsername={botUsername} />
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">{children}</div>
    </main>
  )
}
