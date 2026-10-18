"use client"

import type { Control, FieldPath, FieldValues } from "react-hook-form"
import { OptionChips, TextRow } from "@/components/kit/form-row"
import { MultiSelectRow, SelectRow } from "@/components/kit/picker-sheet"
import { type FormField, isChoice } from "@/lib/fields"
import type { CustomerOption } from "@/lib/types"

// FieldAnswer is the row of one field of a type, at the form path it is
// given, by the field's kind, as the prototype draws a form: a line of text
// or digits (its placeholder says whether it is «Majburiy» or «ixtiyoriy»),
// a choice of one or of several made in a sheet (the row says what is
// chosen, «Tanlanmagan» while nothing is), or the options as chips (radios
// or checkboxes, «· ixtiyoriy» beside the name of one that may be left
// empty). options is what the field's dropdown offers. A disabled answer is
// shown and not changed (a customer that is there, linked to an order).
export function FieldAnswer<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  field,
  options,
  disabled,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  field: FormField
  options: CustomerOption[]
  disabled?: boolean
}) {
  // An option goes by its id, as the form holds it.
  const choices = options.map((o) => ({ value: String(o.id), label: o.label }))
  // A choice with nothing to choose from: the options are the owner's to
  // add, or to turn back on.
  const note = isChoice(field.kind) && options.length === 0 ? "Faol variant yo'q. Variantlar Sozlamalarda qo'shiladi." : undefined
  const prompt = field.required ? "Tanlang" : "Tanlanmagan"
  const hint = note && <p className="-mt-1 px-4 pb-2.5 text-xs text-pretty text-muted-foreground">{note}</p>
  switch (field.kind) {
    case "dropdown":
      return (
        <>
          <SelectRow
            control={control}
            name={name}
            label={field.label}
            options={choices}
            none={field.required ? undefined : "Tanlanmagan"}
            placeholder={prompt}
            note={note}
            disabled={disabled}
          />
          {hint}
        </>
      )
    case "multi_dropdown":
      return (
        <>
          <MultiSelectRow control={control} name={name} label={field.label} options={choices} placeholder={prompt} note={note} disabled={disabled} />
          {hint}
        </>
      )
    case "radio":
    case "checkbox":
      return (
        <OptionChips
          control={control}
          name={name}
          label={field.label}
          options={choices}
          multiple={field.kind === "checkbox"}
          optional={!field.required}
          disabled={disabled}
          empty={note}
        />
      )
    default:
      return (
        <TextRow
          control={control}
          name={name}
          label={field.label}
          // A whole number is typed on the digits keyboard.
          inputMode={field.kind === "int" ? "numeric" : undefined}
          autoComplete="off"
          placeholder={field.required ? "Majburiy" : "ixtiyoriy"}
          disabled={disabled}
        />
      )
  }
}
