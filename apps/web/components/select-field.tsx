"use client"

import { type ReactNode, useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

// SelectOption is one choice of a select: what the form holds for it and
// what the user reads.
export interface SelectOption {
  value: string
  label: string
}

// Aria is what a select's button is told for screen readers: its name when
// no label points at it, whether its answer is wrong, and what describes it.
interface Aria {
  "aria-label"?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

// SelectBox is a choice of one option, as shadcn's select (Base UI): a
// button that says the chosen option's name and opens the options in a
// list. value is the chosen option's value, "" while none is chosen: then
// the button says empty (an option of its own, which clears the choice)
// or, without one, the placeholder (a prompt, not an option).
export function SelectBox({
  id,
  value,
  onChange,
  onBlur,
  options,
  empty,
  placeholder,
  disabled,
  className,
  ...aria
}: Aria & {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  options: SelectOption[]
  empty?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  // The items tell the button the name of what is chosen, the empty choice too.
  const items = empty ? [{ value: null, label: empty }, ...options] : options
  return (
    <Select value={value === "" ? null : value} onValueChange={(next) => onChange(next ?? "")} items={items} disabled={disabled}>
      <SelectTrigger id={id} onBlur={onBlur} className={cn("w-full", className)} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {empty && <SelectItem value={null}>{empty}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// MultiSelectBox is a choice of several options: the button says the
// chosen options' names, or empty while none is chosen; the list stays open
// while options are chosen and taken back, each with a mark.
export function MultiSelectBox({
  id,
  value,
  onChange,
  onBlur,
  options,
  empty = "Tanlanmagan",
  disabled,
  className,
  ...aria
}: Aria & {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  onBlur?: () => void
  options: SelectOption[]
  empty?: string
  disabled?: boolean
  className?: string
}) {
  const names = (chosen: string[]) =>
    options
      .filter((option) => chosen.includes(option.value))
      .map((option) => option.label)
      .join(", ")
  return (
    <Select multiple value={value} onValueChange={(next) => onChange(next)} items={options} disabled={disabled}>
      {/* The names wrap: a choice of several may run long. */}
      <SelectTrigger id={id} onBlur={onBlur} className={cn("h-auto min-h-8 w-full py-1 whitespace-normal", className)} {...aria}>
        <SelectValue placeholder={empty} className="line-clamp-none! text-left">
          {(chosen: string[]) => (chosen.length > 0 ? names(chosen) : empty)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// SelectField is a labeled SelectBox bound to a react-hook-form field, with
// its error under it.
export function SelectField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  options,
  empty,
  placeholder,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: ReactNode
  options: SelectOption[]
  empty?: string
  placeholder?: string
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <SelectBox
            id={id}
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
            empty={empty}
            placeholder={placeholder}
            disabled={field.disabled}
            aria-invalid={fieldState.invalid}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
