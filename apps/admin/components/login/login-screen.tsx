"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"
import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { api, ApiError, call } from "@/lib/api"
import { waitForWebApp } from "@/lib/telegram"
import type { TelegramWebApp } from "@/types/telegram"
import { OtpLogin } from "./otp-login"

type Stage =
  | { kind: "code"; notice?: string }
  | { kind: "checking" }
  | { kind: "not_admin"; webApp: TelegramWebApp }
  | { kind: "no_cookie"; webApp: TelegramWebApp }

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
      try {
        await call(api.POST("/admin/auth/telegram", { body: { initData: webApp.initData } }))
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.code === "not_admin") setStage({ kind: "not_admin", webApp })
        else setStage({ kind: "code", notice: (error as Error).message })
        return
      }
      // A browser that keeps no cookie in this frame would send every page
      // back here: check that the session sticks before leaving.
      try {
        await call(api.GET("/admin/me"))
      } catch {
        if (!cancelled) setStage({ kind: "no_cookie", webApp })
        return
      }
      if (!cancelled) router.replace("/companies")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  if (stage.kind === "not_admin") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Sizda ruxsat yo&apos;q</h1>
        <p className="text-sm text-muted-foreground">
          Panelga faqat adminlar kira oladi. Kerak bo&apos;lsa, adminga Telegram ID&apos;ingizni yuboring.
        </p>
        <p className="font-mono text-sm">Telegram ID: {stage.webApp.initDataUnsafe.user?.id}</p>
        <Button className="mt-2" onClick={() => stage.webApp.close()}>
          Yopish
        </Button>
      </Centered>
    )
  }
  if (stage.kind === "no_cookie") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Kirib bo&apos;lmadi</h1>
        <p className="text-sm text-muted-foreground">
          Brauzer kirish ma&apos;lumotini saqlamadi. Panelni telefon yoki kompyuterdagi Telegram ilovasida oching.
        </p>
        <Button className="mt-2" onClick={() => stage.webApp.close()}>
          Yopish
        </Button>
      </Centered>
    )
  }
  if (stage.kind === "checking") {
    return (
      <Centered>
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Telegram orqali kirilmoqda…</p>
      </Centered>
    )
  }
  return <OtpLogin botUsername={botUsername} notice={stage.notice} />
}

// Centered is every screen of the Telegram sign-in: what it says, under the brand.
function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Brand className="mb-3 text-xl" />
        {children}
      </div>
    </main>
  )
}
