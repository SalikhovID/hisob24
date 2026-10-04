"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Brand } from "@/components/brand"
import { buttonVariants } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { cn } from "@/lib/utils"
import { CodeField } from "./code-field"
import { LoginFrame } from "./login-frame"

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
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full rounded-xl")}
            >
              @{botUsername}
            </a>
          )}
          <CodeField
            ref={input}
            value={code}
            onChange={(value) => {
              setCode(value)
              if (login.isError) login.reset()
            }}
            onComplete={(value) => login.mutate(value)}
            invalid={login.isError}
            disabled={login.isPending}
          />
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
