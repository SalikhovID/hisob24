"use client"

import { useEffect, useId, useState } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { customerName } from "@/lib/customers"
import { formatPhone, formatPhoneInput } from "@/lib/phone"
import { useCustomerSuggestions } from "@/lib/queries"
import type { Customer, CustomerType } from "@/lib/types"
import { cn } from "@/lib/utils"

// How many customers are suggested at most.
const SHOWN = 5

// CustomerPicker is the phone of a new task's customer, as +998 __ ___ __ __,
// and, under it, the customers of the company whose phones begin with what
// was typed: three digits on, after a pause, five at most, each by its
// name, phone and type. The arrow keys walk them, Enter or a click takes
// one, Escape puts them away. onSelect gets the one taken: the form then
// shows that customer and asks nothing more about it.
export function CustomerPicker<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  companyId,
  types,
  onSelect,
  disabled,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  companyId: number
  types: CustomerType[]
  onSelect: (customer: Customer) => void
  disabled?: boolean
}) {
  const id = useId()
  const listId = `${id}-list`
  // The digits typed, and those the suggestions are asked for, which
  // follow them once typing pauses for 300 ms.
  const [typed, setTyped] = useState("")
  const [digits, setDigits] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDigits(typed), 300)
    return () => clearTimeout(timer)
  }, [typed])
  const suggestions = useCustomerSuggestions(companyId, digits)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const items = digits.length >= 3 && suggestions.data ? suggestions.data.items.slice(0, SHOWN) : []
  const shown = open && !disabled && items.length > 0
  const typeOf = (customer: Customer) => types.find((type) => type.id === customer.type_id)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const choose = (customer: Customer) => {
          field.onChange(formatPhoneInput(customer.phone))
          setOpen(false)
          setActive(-1)
          onSelect(customer)
        }
        return (
          <Field data-invalid={fieldState.invalid || undefined} className="relative">
            <FieldLabel htmlFor={id}>Telefon raqami</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText className="text-foreground">+998</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="__ ___ __ __"
                role="combobox"
                aria-expanded={shown}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                {...field}
                onChange={(event) => {
                  const value = formatPhoneInput(event.target.value)
                  field.onChange(value)
                  setTyped(value.replace(/\D/g, ""))
                  setOpen(true)
                  setActive(-1)
                }}
                onBlur={() => {
                  field.onBlur()
                  setOpen(false)
                  setActive(-1)
                }}
                onKeyDown={(event) => {
                  if (disabled) return
                  switch (event.key) {
                    case "ArrowDown":
                      if (items.length === 0) return
                      event.preventDefault()
                      setOpen(true)
                      setActive((current) => Math.min(current + 1, items.length - 1))
                      return
                    case "ArrowUp":
                      if (!shown) return
                      event.preventDefault()
                      setActive((current) => Math.max(current - 1, 0))
                      return
                    case "Enter":
                      if (!shown || active < 0) return
                      event.preventDefault()
                      choose(items[active])
                      return
                    case "Escape":
                      if (!shown) return
                      event.preventDefault()
                      event.stopPropagation()
                      setOpen(false)
                      setActive(-1)
                      return
                  }
                }}
              />
            </InputGroup>
            {shown && (
              <ul
                id={listId}
                role="listbox"
                aria-label="Mijoz takliflari"
                className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border bg-popover py-1 text-sm text-popover-foreground shadow-md"
              >
                {items.map((customer, index) => {
                  const customerTitle = customerName(customer, typeOf(customer))
                  return (
                    <li
                      key={customer.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className={cn("flex cursor-default items-baseline gap-2 px-3 py-1.5", index === active && "bg-accent text-accent-foreground")}
                      // The press must not take the focus (and the list) away
                      // before the click lands.
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => setActive(index)}
                      onClick={() => choose(customer)}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{customerTitle ?? formatPhone(customer.phone)}</span>
                      {customerTitle && <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatPhone(customer.phone)}</span>}
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{typeOf(customer)?.name}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}
