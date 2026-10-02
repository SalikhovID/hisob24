"use client"

import { useMutation } from "@tanstack/react-query"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { api, call } from "@/lib/api"
import { phoneDigits } from "@/lib/phone"
import { setAccessToken } from "@/lib/session"

const SLOTS = [0, 1, 2, 3, 4, 5]

// CodeStep is the second login step: the code from the SMS. There is no
// button: the sixth digit sends the code.
export function CodeStep({
  phone,
  retryAfter,
  onChangePhone,
}: {
  phone: string
  retryAfter: number
  onChangePhone: () => void
}) {
  void retryAfter
  void onChangePhone
  const router = useRouter()
  const [code, setCode] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const verify = useMutation({
    mutationFn: (code: string) =>
      call(api.POST("/app/auth/sms/verify", { body: { phone: phoneDigits(phone) ?? "", code } })),
    // One company is chosen by the API; with several, company_id is null and
    // the user picks one.
    onSuccess: (tokens) => {
      setAccessToken(tokens.access_token)
      router.replace(tokens.company_id === null ? "/select-company" : "/")
    },
    // A refused code is cleared, so the next one is typed from the start.
    onError: () => {
      setCode("")
      requestAnimationFrame(() => input.current?.focus())
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <InputOTP
          ref={input}
          aria-label="Kod"
          maxLength={6}
          pattern={REGEXP_ONLY_DIGITS}
          value={code}
          onChange={setCode}
          onComplete={(value: string) => verify.mutate(value)}
          disabled={verify.isPending}
          autoFocus
        >
          <InputOTPGroup>
            {SLOTS.map((index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={verify.isError} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {verify.isError && (
        <p role="alert" className="text-center text-sm text-destructive">
          {verify.error.message}
        </p>
      )}
    </div>
  )
}
