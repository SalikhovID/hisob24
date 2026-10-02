"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { api, call } from "@/lib/api"
import { formatPhoneInput, phoneDigits } from "@/lib/phone"

const schema = z.object({
  phone: z.string().refine((phone) => phoneDigits(phone) !== null, "Telefon raqamini to'liq kiriting"),
})

// PhoneStep is the first login step: the phone number the code goes to, as
// +998 __ ___ __ __. The +998 sits beside the field, out of the caret's
// reach; the field takes the rest, whatever is typed or pasted. phone is
// the number as the API takes it (998901234567), in and out.
export function PhoneStep({
  defaultPhone = "",
  onSent,
}: {
  defaultPhone?: string
  onSent: (phone: string, retryAfter: number) => void
}) {
  const id = useId()
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
      <Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={id}>Telefon raqami</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText className="text-foreground">+998</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="__ ___ __ __"
                aria-invalid={fieldState.invalid}
                {...field}
                onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
              />
            </InputGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {send.isError && (
        <p role="alert" className="text-sm text-destructive">
          {send.error.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={send.isPending}>
        Kodni olish
      </Button>
    </form>
  )
}
