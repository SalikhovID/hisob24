"use client"

import { type ComponentProps, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// TextField is a labeled input bound to a react-hook-form field, with its
// error under it.
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  ...input
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
} & Omit<ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input id={id} aria-invalid={fieldState.invalid} {...input} {...field} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
