"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, call } from "@/lib/api"
import { formatPhoneInput, phoneDigits } from "@/lib/phone"

const schema = z.object({
  phone: z.string().refine((phone) => phoneDigits(phone) !== null, "Telefon raqamini to'liq kiriting"),
})

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
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { phone: defaultPhone } })
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
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={id}>Telefon raqami</FieldLabel>
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={fieldState.invalid}
              {...field}
              onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Button type="submit" className="w-full" disabled={send.isPending}>
        Kodni olish
      </Button>
    </form>
  )
}
