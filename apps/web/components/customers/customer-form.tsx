"use client"

import { ChevronDownIcon } from "lucide-react"
import { type ReactNode, useId } from "react"
import { type Control, Controller, type ControllerFieldState } from "react-hook-form"
import { PhoneField } from "@/components/phone-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { type CustomerForm, type CustomerOutput, fieldKey } from "@/lib/customers"
import type { CustomerDropdown, CustomerField, CustomerOption, CustomerType } from "@/lib/types"

type FormControl = Control<CustomerForm, unknown, CustomerOutput>

// Labeled is one question of the form: its name, a quiet word beside it when
// it may be left empty, the input and what is wrong with the answer. The
// word stands outside the name, so the input goes by the field's name alone.
// A group of inputs (radios, checkboxes, a menu) is named by the name's id,
// a single input by the label that points at it.
function Labeled({
  id,
  label,
  required,
  state,
  group = false,
  children,
}: {
  id: string
  label: string
  required: boolean
  state: ControllerFieldState
  group?: boolean
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
      <FieldError errors={[state.error]} />
    </Field>
  )
}

// A choice among radios that may stay unmade is taken back with this one.
const NONE = "none"

// option is one radio or checkbox with its name beside it.
const option = "flex w-fit items-center gap-2 text-sm leading-5"

// Answer is the input of one field of a type, by the field's kind: a line of
// text, digits, the browser's own select, radios, checkboxes, or a menu of
// checkboxes behind a button that says what is chosen.
function Answer({ control, field, options }: { control: FormControl; field: CustomerField; options: CustomerOption[] }) {
  const id = useId()
  const labelId = `${id}-label`
  const hint = field.required ? undefined : `${id}-hint`
  return (
    <Controller
      control={control}
      name={`values.${fieldKey(field)}`}
      render={({ field: input, fieldState }) => {
        const labeled = { id, label: field.label, required: field.required, state: fieldState }
        const one = typeof input.value === "string" ? input.value : ""
        const several = Array.isArray(input.value) ? input.value : []
        const toggle = (value: string, on: boolean) =>
          input.onChange(on ? [...several, value] : several.filter((chosen) => chosen !== value))

        switch (field.kind) {
          case "dropdown":
            return (
              <Labeled {...labeled}>
                <NativeSelect
                  id={id}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={hint}
                  className="w-full"
                  {...input}
                  value={one}
                >
                  <NativeSelectOption value="">Tanlanmagan</NativeSelectOption>
                  {options.map((o) => (
                    <NativeSelectOption key={o.id} value={o.id}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Labeled>
            )
          case "radio":
            return (
              <Labeled {...labeled} group>
                <RadioGroup
                  aria-labelledby={labelId}
                  aria-describedby={hint}
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
                        onCheckedChange={(checked) => toggle(String(o.id), checked)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </Labeled>
            )
          case "multi_dropdown": {
            const chosen = options.filter((o) => several.includes(String(o.id)))
            return (
              <Labeled {...labeled} group>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        id={id}
                        aria-labelledby={`${labelId} ${id}`}
                        aria-describedby={hint}
                        className="h-auto min-h-8 w-full justify-between gap-2 py-1 text-left font-normal whitespace-normal"
                      />
                    }
                  >
                    <span className={chosen.length > 0 ? "min-w-0 [overflow-wrap:anywhere]" : "text-muted-foreground"}>
                      {chosen.length > 0 ? chosen.map((o) => o.label).join(", ") : "Tanlanmagan"}
                    </span>
                    <ChevronDownIcon className="text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-(--anchor-width)">
                    {options.map((o) => (
                      <DropdownMenuCheckboxItem
                        key={o.id}
                        checked={several.includes(String(o.id))}
                        onCheckedChange={(checked) => toggle(String(o.id), checked)}
                        closeOnClick={false}
                      >
                        {o.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </Labeled>
            )
          }
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
            (o) => o.is_active,
          )}
        />
      ))}
    </FieldGroup>
  )
}
