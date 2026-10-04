"use client"

import { type ReactNode, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

// CheckboxField is one yes-or-no mark bound to a react-hook-form field: the
// box, then what ticking it means.
export function CheckboxField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: ReactNode
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Checkbox id={id} checked={!!field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
          <FieldLabel htmlFor={id} className="font-normal">
            {label}
          </FieldLabel>
        </Field>
      )}
    />
  )
}
