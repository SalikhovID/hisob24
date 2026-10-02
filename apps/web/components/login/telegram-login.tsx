"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { api, ApiError, call } from "@/lib/api"
import { setAccessToken } from "@/lib/session"
import type { TelegramWebApp } from "@/types/telegram"

type Stage =
  | { kind: "checking" }
  | { kind: "no_access"; message: string }
  // declined: the user would not share the contact from the app; late: they
  // did, but it has not reached the bot yet.
  | { kind: "not_shared"; declined?: boolean; late?: boolean }

// The contact goes to the bot through Telegram: tries after 1, 2 and 3 s.
const RETRIES = [1000, 2000, 3000]
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  // signIn asks the API once; "not_shared" leaves the next step to the caller.
  const signIn = useCallback(
    async (cancelled: () => boolean): Promise<"done" | "not_shared"> => {
      try {
        const tokens = await call(api.POST("/app/auth/telegram", { body: { initData: webApp.initData } }))
        if (cancelled()) return "done"
        setAccessToken(tokens.access_token)
        router.replace(tokens.company_id === null ? "/select-company" : "/")
      } catch (error) {
        if (cancelled()) return "done"
        if (error instanceof ApiError && error.code === "phone_not_shared") return "not_shared"
        if (error instanceof ApiError && error.code === "no_access") setStage({ kind: "no_access", message: error.message })
        else onFallback((error as Error).message)
      }
      return "done"
    },
    [webApp, router, onFallback],
  )

  useEffect(() => {
    let cancelled = false
    signIn(() => cancelled).then((result) => {
      if (!cancelled && result === "not_shared") setStage({ kind: "not_shared" })
    })
    return () => {
      cancelled = true
    }
  }, [signIn])

  // tryAgain waits for the contact to reach the bot, trying at each delay.
  const tryAgain = async (delays: number[]) => {
    setStage({ kind: "checking" })
    for (const delay of delays) {
      await wait(delay)
      if ((await signIn(() => false)) === "done") return
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

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">{children}</div>
    </main>
  )
}
