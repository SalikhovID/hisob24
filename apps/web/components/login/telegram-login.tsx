"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { api, ApiError, call } from "@/lib/api"
import { setAccessToken } from "@/lib/session"
import type { TelegramWebApp } from "@/types/telegram"

type Stage =
  | { kind: "checking" }
  // no_cookie: the frame keeps no session cookie (Telegram Web without CHIPS).
  | { kind: "no_cookie" }
  | { kind: "no_access"; message: string }
  // declined: the user would not share the contact from the app; late: they
  // did, but it has not reached the bot yet.
  | { kind: "not_shared"; declined?: boolean; late?: boolean }

// The contact goes to the bot through Telegram: tries after 1, 2 and 3 s.
const RETRIES = [1000, 2000, 3000]
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Outcome =
  | { kind: "signed_in"; companyId: number | null }
  | { kind: "not_shared" }
  | { kind: "no_access"; message: string }
  | { kind: "no_cookie" }
  | { kind: "failed"; notice: string }

// attempt signs the Mini App user in once and says how it went; showing it
// is the component's part. A cancelled attempt stops before the refresh: two
// rotating the one refresh cookie at once would leave one of them refused.
async function attempt(initData: string, cancelled = () => false): Promise<Outcome | null> {
  let tokens
  try {
    tokens = await call(api.POST("/app/auth/telegram", { body: { initData } }))
  } catch (error) {
    if (error instanceof ApiError && error.code === "phone_not_shared") return { kind: "not_shared" }
    if (error instanceof ApiError && error.code === "no_access") return { kind: "no_access", message: error.message }
    return { kind: "failed", notice: (error as Error).message }
  }
  if (cancelled()) return null
  setAccessToken(tokens.access_token)
  // A frame that keeps no cookie would send every page back to /login:
  // check that the session sticks before leaving.
  try {
    const refreshed = await call(api.POST("/app/auth/refresh"))
    setAccessToken(refreshed.access_token)
  } catch {
    return { kind: "no_cookie" }
  }
  return { kind: "signed_in", companyId: tokens.company_id }
}

// TelegramLogin signs in the user who opened the Mini App, with no code: the
// user bot signed initData, and the account shared a user's phone with it.
// An account that shared none can share it from here: Telegram sends the
// contact to the bot, and the sign-in is tried again. onFallback hands over
// to the SMS form, saying why.
export function TelegramLogin({
  webApp,
  onFallback,
}: {
  webApp: TelegramWebApp
  onFallback: (notice: string) => void
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ kind: "checking" })

  const apply = useCallback(
    (outcome: Outcome) => {
      if (outcome.kind === "signed_in") router.replace(outcome.companyId === null ? "/select-company" : "/")
      else if (outcome.kind === "failed") onFallback(outcome.notice)
      else setStage(outcome.kind === "not_shared" ? { kind: "not_shared" } : outcome)
    },
    [router, onFallback],
  )

  useEffect(() => {
    let cancelled = false
    attempt(webApp.initData, () => cancelled).then((outcome) => {
      if (!cancelled && outcome) apply(outcome)
    })
    return () => {
      cancelled = true
    }
  }, [webApp, apply])

  // tryAgain waits for the contact to reach the bot, trying at each delay.
  const tryAgain = async (delays: number[]) => {
    setStage({ kind: "checking" })
    for (const delay of delays) {
      await wait(delay)
      const outcome = await attempt(webApp.initData)
      if (outcome && outcome.kind !== "not_shared") {
        apply(outcome)
        return
      }
    }
    setStage({ kind: "not_shared", late: true })
  }

  const share = () =>
    webApp.requestContact?.((shared) => {
      if (!shared) {
        setStage({ kind: "not_shared", declined: true })
        return
      }
      void tryAgain(RETRIES)
    })

  if (stage.kind === "no_cookie") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Kirib bo&apos;lmadi</h1>
        <p className="text-sm text-muted-foreground">
          Brauzer kirish ma&apos;lumotini saqlamadi. Mini App&apos;ni telefon yoki kompyuterdagi Telegram ilovasida
          oching.
        </p>
        <Button className="mt-2" onClick={() => webApp.close()}>
          Yopish
        </Button>
      </Centered>
    )
  }
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
  if (stage.kind === "not_shared") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Telefon raqamingiz ulanmagan</h1>
        <p className="text-sm text-muted-foreground">Hisob24&apos;ga kirish uchun Telegram raqamingizni botga yuboring.</p>
        {stage.late ? (
          <>
            <p className="text-sm text-muted-foreground">Raqam hali yetib kelmadi.</p>
            <Button className="mt-2 w-full" onClick={() => void tryAgain([0])}>
              Qayta urinish
            </Button>
          </>
        ) : (
          webApp.requestContact && (
            <Button className="mt-2 w-full" onClick={share}>
              Raqamni yuborish
            </Button>
          )
        )}
        {(stage.declined || !webApp.requestContact) && <BotInstructions webApp={webApp} />}
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

// BotInstructions is the way to share the phone without the app: in the bot.
function BotInstructions({ webApp }: { webApp: TelegramWebApp }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">Botga qaytib, /start yozing va raqamingizni yuboring.</p>
      <Button variant="outline" className="w-full" onClick={() => webApp.close()}>
        Botga qaytish
      </Button>
    </>
  )
}

// Centered is every screen of this login: what it says, under the logo. Its
// top padding keeps clear of what Telegram lays over a full-screen Mini App.
function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 pb-4 pt-safe-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <Logo className="mb-3 h-7" />
        {children}
      </div>
    </main>
  )
}
