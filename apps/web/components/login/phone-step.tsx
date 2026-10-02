"use client"

import { useMutation } from "@tanstack/react-query"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, call } from "@/lib/api"
import { formatPhoneInput, phoneDigits } from "@/lib/phone"

// PhoneStep is the first login step: the phone number the code goes to. The
// field always reads +998 __ ___ __ __, whatever is typed or pasted.
export function PhoneStep({
  defaultPhone = "+998 ",
  onSent,
}: {
  defaultPhone?: string
  onSent: (phone: string, retryAfter: number) => void
}) {
  const id = useId()
  const form = useForm({ defaultValues: { phone: defaultPhone } })
  const send = useMutation({
    mutationFn: ({ digits }: { phone: string; digits: string }) =>
      call(api.POST("/app/auth/sms/send", { body: { phone: digits } })),
    onSuccess: (data, { phone }) => onSent(phone, data.retry_after),
  })
  const submit = form.handleSubmit(({ phone }) => {
    const digits = phoneDigits(phone)
    if (digits) send.mutate({ phone, digits })
  })

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <Controller
        control={form.control}
        name="phone"
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor={id}>Telefon raqami</FieldLabel>
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...field}
              onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
            />
          </Field>
        )}
      />
      <Button type="submit" className="w-full" disabled={send.isPending}>
        Kodni olish
      </Button>
    </form>
  )
}
