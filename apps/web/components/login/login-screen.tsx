"use client"

import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { Refusal } from "@/components/refusal"
import { formatPhone } from "@/lib/phone"
import { waitForWebApp } from "@/lib/telegram"
import { cn } from "@/lib/utils"
import type { TelegramWebApp } from "@/types/telegram"
import { CodeStep } from "./code-step"
import { LoginFrame } from "./login-frame"
import { PhoneStep } from "./phone-step"
import { TelegramLogin } from "./telegram-login"

type Step = { kind: "phone"; phone?: string } | { kind: "code"; phone: string; retryAfter: number }

// LoginScreen signs a user in: inside Telegram by itself (the Mini App), in
// a browser with a code (the phone number, then the code, which the API
// sends by SMS or, to a phone linked to the user bot, in Telegram; the
// screen does not say which), in the login's frame. notice says why a Mini
// App sign-in fell back to the code.
export function LoginScreen() {
  const [step, setStep] = useState<Step>({ kind: "phone" })
  const [miniApp, setMiniApp] = useState<TelegramWebApp | null>(null)
  const [notice, setNotice] = useState<string>()

  useEffect(() => {
    let cancelled = false
    waitForWebApp().then((webApp) => {
      if (!cancelled && webApp) setMiniApp(webApp)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (miniApp) {
    return (
      <TelegramLogin
        webApp={miniApp}
        onFallback={(reason) => {
          setMiniApp(null)
          setNotice(reason)
        }}
      />
    )
  }

  // The step on screen was reached by an action (a code sent, the number
  // asked for again): only then does it slide in, from the side it came.
  const moved = step.kind === "code" || step.phone !== undefined

  return (
    <LoginFrame brand={<Logo className="h-7 lg:h-8" />} tagline="Biznesingiz uchun hisob tizimi">
      {notice && <Refusal className="mb-6">{notice}</Refusal>}
      <div
        key={step.kind}
        className={cn(
          "space-y-8",
          moved && "animate-in duration-200 fade-in-0",
          moved && (step.kind === "code" ? "slide-in-from-right-4" : "slide-in-from-left-4"),
        )}
      >
        <div className="space-y-1.5">
          <h2 className="text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">
            {step.kind === "phone" ? "Kirish" : "Kodni kiriting"}
          </h2>
          <p className="text-md text-muted-foreground">
            {step.kind === "phone"
              ? "Telefon raqamingizni kiriting, kod SMS yoki Telegram botga keladi"
              : `Kod ${formatPhone(step.phone)} raqamiga yuborildi. SMS yoki Telegram botni tekshiring`}
          </p>
        </div>
        {step.kind === "phone" ? (
          <PhoneStep
            defaultPhone={step.phone}
            onSent={(phone, retryAfter) => setStep({ kind: "code", phone, retryAfter })}
          />
        ) : (
          <CodeStep
            phone={step.phone}
            retryAfter={step.retryAfter}
            onChangePhone={() => setStep({ kind: "phone", phone: step.phone })}
          />
        )}
      </div>
    </LoginFrame>
  )
}
