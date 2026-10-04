"use client"

import { type ReactNode, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"

// SelectField is a labeled select bound to a react-hook-form field, with its
// error under it. It is the browser's own select: on a phone it opens the
// system's picker. The options are its children.
export function SelectField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  children,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <NativeSelect id={id} aria-invalid={fieldState.invalid} className="w-full" {...field}>
            {children}
          </NativeSelect>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
