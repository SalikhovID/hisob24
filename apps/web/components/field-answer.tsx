"use client"

import { type ReactNode, useId } from "react"
import { type Control, Controller, type ControllerFieldState, type FieldPath, type FieldValues } from "react-hook-form"
import { MultiSelectBox, SelectBox } from "@/components/select-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { type FormField, isChoice } from "@/lib/fields"
import type { CustomerOption } from "@/lib/types"

// Labeled is one question of a form: its name, a quiet word beside it when
// it may be left empty, the input and what is wrong with the answer. The
// word stands outside the name, so the input goes by the field's name alone.
// A group of inputs (radios, checkboxes) is named by the name's id, a single
// input (a line, a select's button) by the label that points at it.
function Labeled({
  id,
  label,
  required,
  state,
  group = false,
  note,
  children,
}: {
  id: string
  label: string
  required: boolean
  state: ControllerFieldState
  group?: boolean
  // note is a quiet line under the input: why it offers nothing.
  note?: string
  children: ReactNode
}) {
  return (
    <Field data-invalid={state.invalid || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        {group ? <FieldTitle id={`${id}-label`}>{label}</FieldTitle> : <FieldLabel htmlFor={id}>{label}</FieldLabel>}
        {!required && (
          <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">
            ixtiyoriy
          </span>
        )}
      </div>
      {children}
      {note && <p className="text-[0.8125rem] leading-5 text-pretty text-muted-foreground">{note}</p>}
      <FieldError errors={[state.error]} />
    </Field>
  )
}

// A choice among radios that may stay unmade is taken back with this one.
const NONE = "none"

// option is one radio or checkbox with its name beside it.
const option = "flex w-fit items-center gap-2 text-sm leading-5"

// FieldAnswer is the input of one field of a type, at the form path it is
// given, by the field's kind: a line of text, digits, a select of one option
// or of several (shadcn's), radios, or checkboxes. options is what the
// field's dropdown offers. A disabled answer is shown and not changed (a
// customer that is there, linked to a task).
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
  const id = useId()
  const labelId = `${id}-label`
  const hint = field.required ? undefined : `${id}-hint`
  // A select's options go by the option's id, as the form holds them.
  const choices = options.map((o) => ({ value: String(o.id), label: o.label }))
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: input, fieldState }) => {
        const labeled = {
          id,
          label: field.label,
          required: field.required,
          state: fieldState,
          // A choice with nothing to choose from: the options are the
          // owner's to add, or to turn back on.
          note: isChoice(field.kind) && options.length === 0 ? "Faol variant yo'q. Variantlar Sozlamalarda qo'shiladi." : undefined,
        }
        const one = typeof input.value === "string" ? input.value : ""
        const several: string[] = Array.isArray(input.value) ? input.value : []
        const toggle = (value: string, on: boolean) =>
          input.onChange(on ? [...several, value] : several.filter((chosen) => chosen !== value))

        switch (field.kind) {
          case "dropdown":
            return (
              <Labeled {...labeled}>
                <SelectBox
                  id={id}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={hint}
                  disabled={disabled}
                  value={one}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  empty="Tanlanmagan"
                  options={choices}
                />
              </Labeled>
            )
          case "radio":
            return (
              <Labeled {...labeled} group>
                <RadioGroup
                  aria-labelledby={labelId}
                  aria-describedby={hint}
                  disabled={disabled}
                  value={one === "" ? NONE : one}
                  onValueChange={(value) => input.onChange(value === NONE ? "" : value)}
                >
                  {!field.required && (
                    <label className={option}>
                      <RadioGroupItem value={NONE} />
                      <span className="text-muted-foreground">Tanlanmagan</span>
                    </label>
                  )}
                  {options.map((o) => (
                    <label key={o.id} className={option}>
                      <RadioGroupItem value={String(o.id)} />
                      {o.label}
                    </label>
                  ))}
                </RadioGroup>
              </Labeled>
            )
          case "checkbox":
            return (
              <Labeled {...labeled} group>
                <div role="group" aria-labelledby={labelId} aria-describedby={hint} className="grid gap-2">
                  {options.map((o) => (
                    <label key={o.id} className={option}>
                      <Checkbox
                        checked={several.includes(String(o.id))}
                        disabled={disabled}
                        onCheckedChange={(checked) => toggle(String(o.id), checked)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </Labeled>
            )
          case "multi_dropdown":
            return (
              <Labeled {...labeled}>
                <MultiSelectBox
                  id={id}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={hint}
                  disabled={disabled}
                  value={several}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  options={choices}
                />
              </Labeled>
            )
          default:
            return (
              <Labeled {...labeled}>
                <Input
                  id={id}
                  // A whole number is typed on the digits keyboard.
                  inputMode={field.kind === "int" ? "numeric" : undefined}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={hint}
                  autoComplete="off"
                  disabled={disabled}
                  {...input}
                  value={one}
                />
              </Labeled>
            )
        }
      }}
    />
  )
}
