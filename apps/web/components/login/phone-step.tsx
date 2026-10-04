"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { PendingButton } from "@/components/pending-button"
import { PhoneField } from "@/components/phone-field"
import { api, call } from "@/lib/api"
import { formatPhoneInput, phoneDigits } from "@/lib/phone"
import { useHydrated } from "@/lib/use-hydrated"

const schema = z.object({
  phone: z.string().refine((phone) => phoneDigits(phone) !== null, "Telefon raqamini to'liq kiriting"),
})

// PhoneStep is the first login step: the phone number the code goes to.
// phone is the number as the API takes it (998901234567), in and out.
export function PhoneStep({
  defaultPhone = "",
  onSent,
}: {
  defaultPhone?: string
  onSent: (phone: string, retryAfter: number) => void
}) {
  const hydrated = useHydrated()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { phone: formatPhoneInput(defaultPhone) } })
  const send = useMutation({
    mutationFn: (phone: string) => call(api.POST("/app/auth/sms/send", { body: { phone } })),
    onSuccess: (data, phone) => onSent(phone, data.retry_after),
  })
  const submit = form.handleSubmit(({ phone }) => {
    const digits = phoneDigits(phone)
    if (digits) send.mutate(digits)
  })

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <PhoneField
        control={form.control}
        name="phone"
        label="Telefon raqami"
        readOnly={!hydrated}
        autoComplete="tel"
        size="lg"
      />
      {send.isError && (
        <p role="alert" className="text-sm text-destructive">
          {send.error.message}
        </p>
      )}
      <PendingButton
        type="submit"
        className="h-12 w-full rounded-xl text-base"
        disabled={!hydrated}
        pending={send.isPending}
      >
        Kodni olish
      </PendingButton>
    </form>
  )
}
