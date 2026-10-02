"use client"

import { useMutation } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { api, call } from "@/lib/api"

const SLOTS = [0, 1, 2, 3, 4, 5]

// OtpLogin is the browser login: the code the admin bot sends after /login.
// There is no button: the sixth digit sends the code.
export function OtpLogin({ botUsername }: { botUsername: string }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const login = useMutation({
    mutationFn: (code: string) => call(api.POST("/admin/auth/otp", { body: { code } })),
    onSuccess: () => router.replace("/companies"),
  })

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Hisob24 Admin</h1>
          <p className="text-sm text-muted-foreground">
            Kodni olish uchun botga <code className="rounded bg-muted px-1 py-0.5 font-mono">/login</code> yozing
          </p>
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
        </div>
        <div className="flex justify-center">
          <InputOTP
            aria-label="Kod"
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            onComplete={(value: string) => login.mutate(value)}
            disabled={login.isPending}
            autoFocus
          >
            <InputOTPGroup>
              {SLOTS.map((index) => (
                <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      </div>
    </main>
  )
}
