"use client"

import { useState } from "react"
import { formatPhone } from "@/lib/phone"
import { CodeStep } from "./code-step"
import { PhoneStep } from "./phone-step"

type Step = { kind: "phone"; phone?: string } | { kind: "code"; phone: string; retryAfter: number }

// LoginScreen is the SMS login: the phone number, then the code.
export function LoginScreen() {
  const [step, setStep] = useState<Step>({ kind: "phone" })

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Hisob24</h1>
          <p className="text-sm text-muted-foreground">
            {step.kind === "phone" ? "Telefon raqamingizni kiriting" : `Kod ${formatPhone(step.phone)} raqamiga yuborildi`}
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
    </main>
  )
}
