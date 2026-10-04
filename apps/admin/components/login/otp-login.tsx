"use client"

import { useMutation } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Brand } from "@/components/brand"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { api, call } from "@/lib/api"
import { LoginFrame } from "./login-frame"

const SLOTS = [0, 1, 2, 3, 4, 5]

// OtpLogin is the browser login, in the login's frame: the code the admin
// bot sends after /login. There is no button: the sixth digit sends the
// code. notice says why the code is asked for after all (a failed Telegram
// sign-in).
export function OtpLogin({ botUsername, notice }: { botUsername: string; notice?: string }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const login = useMutation({
    mutationFn: (code: string) => call(api.POST("/admin/auth/otp", { body: { code } })),
    onSuccess: () => router.replace("/companies"),
    // A refused code is cleared, so the next one is typed from the start.
    onError: () => {
      setCode("")
      requestAnimationFrame(() => input.current?.focus())
    },
  })

  return (
    <LoginFrame brand={<Brand className="text-xl lg:text-2xl" />} tagline="Kompaniyalar, billing va adminlar boshqaruvi">
      {notice && (
        <p role="alert" className="mb-6 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          {notice}
        </p>
      )}
      <div className="space-y-8">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">Kirish</h2>
          <p className="text-sm text-muted-foreground">
            Kodni olish uchun botga <code className="rounded bg-muted px-1 py-0.5 font-mono">/login</code> yozing
          </p>
        </div>
        <div className="space-y-4">
          {botUsername && (
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              @{botUsername}
            </a>
          )}
          <div className="flex justify-center">
            <InputOTP
              ref={input}
              aria-label="Kod"
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              value={code}
              onChange={(value: string) => {
                setCode(value)
                if (login.isError) login.reset()
              }}
              onComplete={(value: string) => login.mutate(value)}
              disabled={login.isPending}
              autoFocus
            >
              <InputOTPGroup>
                {SLOTS.map((index) => (
                  <InputOTPSlot key={index} index={index} aria-invalid={login.isError} className="size-11 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {login.isError && (
            <p role="alert" className="text-sm text-destructive">
              {login.error.message}
            </p>
          )}
        </div>
      </div>
    </LoginFrame>
  )
}
