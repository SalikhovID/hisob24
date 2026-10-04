"use client"

import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { formatPhone } from "@/lib/phone"
import { waitForWebApp } from "@/lib/telegram"
import type { TelegramWebApp } from "@/types/telegram"
import { CodeStep } from "./code-step"
import { LoginFrame } from "./login-frame"
import { PhoneStep } from "./phone-step"
import { TelegramLogin } from "./telegram-login"

type Step = { kind: "phone"; phone?: string } | { kind: "code"; phone: string; retryAfter: number }

// LoginScreen signs a user in: inside Telegram by itself (the Mini App), in
// a browser with an SMS code (the phone number, then the code), in the
// login's frame. notice says why a Mini App sign-in fell back to the code.
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

  return (
    <LoginFrame brand={<Logo className="h-8" />} tagline="Biznesingiz uchun hisob tizimi">
      <div className="space-y-6">
        {notice && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {notice}
          </p>
        )}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">
            {step.kind === "phone" ? "Kirish" : "Kodni kiriting"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {step.kind === "phone"
              ? "Telefon raqamingizni kiriting, kod SMS orqali keladi"
              : `Kod ${formatPhone(step.phone)} raqamiga yuborildi`}
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
