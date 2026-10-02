"use client"

import { useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatPhoneInput } from "@/lib/phone"

// PhoneStep is the first login step: the phone number the code goes to. The
// field always reads +998 __ ___ __ __, whatever is typed or pasted.
export function PhoneStep({
  defaultPhone = "+998 ",
  onSent,
}: {
  defaultPhone?: string
  onSent: (phone: string, retryAfter: number) => void
}) {
  void onSent
  const id = useId()
  const form = useForm({ defaultValues: { phone: defaultPhone } })

  return (
    <form noValidate>
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
    </form>
  )
}
