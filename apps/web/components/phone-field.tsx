"use client"

import { useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { formatPhoneInput } from "@/lib/phone"
import { cn } from "@/lib/utils"

// PhoneField is a phone number in a form, as +998 __ ___ __ __. The +998
// sits beside the field, out of the caret's reach; the field takes the rest,
// whatever is typed or pasted, and shows it as 90 123 45 67. phoneDigits
// turns its value into the form the API takes. size "lg" is the login's: the
// number is all its step asks for, in a field tall enough for a thumb.
export function PhoneField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  readOnly,
  autoComplete,
  size = "default",
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  readOnly?: boolean
  autoComplete?: string
  size?: "default" | "lg"
}) {
  const id = useId()
  const large = size === "lg"
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <InputGroup className={cn(large && "h-12 rounded-xl")}>
            <InputGroupAddon className={cn(large && "pl-3.5")}>
              <InputGroupText className={cn("text-foreground", large && "text-lg tabular-nums")}>+998</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete={autoComplete}
              placeholder="__ ___ __ __"
              readOnly={readOnly}
              aria-invalid={fieldState.invalid}
              className={cn(large && "h-full text-lg font-medium tabular-nums md:text-lg")}
              {...field}
              onChange={(event) => field.onChange(formatPhoneInput(event.target.value))}
            />
          </InputGroup>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
