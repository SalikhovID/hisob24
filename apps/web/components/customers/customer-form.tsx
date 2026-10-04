"use client"

import { type ReactNode, useId } from "react"
import { type Control, Controller, type ControllerFieldState } from "react-hook-form"
import { PhoneField } from "@/components/phone-field"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { type CustomerForm, type CustomerOutput, fieldKey } from "@/lib/customers"
import type { CustomerDropdown, CustomerField, CustomerOption, CustomerType } from "@/lib/types"

type FormControl = Control<CustomerForm, unknown, CustomerOutput>

// Labeled is one question of the form: its name, a quiet word beside it when
// it may be left empty, the input and what is wrong with the answer. The
// word stands outside the label, so the input goes by the field's name alone.
function Labeled({
  id,
  label,
  required,
  state,
  children,
}: {
  id: string
  label: string
  required: boolean
  state: ControllerFieldState
  children: ReactNode
}) {
  return (
    <Field data-invalid={state.invalid || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {!required && (
          <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">
            ixtiyoriy
          </span>
        )}
      </div>
      {children}
      <FieldError errors={[state.error]} />
    </Field>
  )
}

// Answer is the input of one field of a type, by the field's kind.
function Answer({ control, field, options }: { control: FormControl; field: CustomerField; options: CustomerOption[] }) {
  const id = useId()
  const hint = field.required ? undefined : `${id}-hint`
  return (
    <Controller
      control={control}
      name={`values.${fieldKey(field)}`}
      render={({ field: input, fieldState }) => (
        <Labeled id={id} label={field.label} required={field.required} state={fieldState}>
          {field.kind === "dropdown" ? (
            <NativeSelect
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={hint}
              className="w-full"
              {...input}
              value={input.value as string}
            >
              <NativeSelectOption value="">Tanlanmagan</NativeSelectOption>
              {options.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <Input
              id={id}
              aria-invalid={fieldState.invalid}
              aria-describedby={hint}
              autoComplete="off"
              {...input}
              value={input.value as string}
            />
          )}
        </Labeled>
      )}
    />
  )
}

// CustomerFields is the form of a type's customer: the phone, which every
// customer has, then the type's fields in their order.
export function CustomerFields({
  control,
  type,
  dropdowns,
}: {
  control: FormControl
  type: CustomerType
  dropdowns: CustomerDropdown[]
}) {
  return (
    <FieldGroup>
      <PhoneField control={control} name="phone" label="Telefon raqami" autoComplete="off" />
      {type.fields.map((field) => (
        <Answer
          key={field.id}
          control={control}
          field={field}
          // A choice offers the options of its dropdown that are not turned off.
          options={(dropdowns.find((dropdown) => dropdown.id === field.dropdown_id)?.options ?? []).filter(
            (option) => option.is_active,
          )}
        />
      ))}
    </FieldGroup>
  )
}
