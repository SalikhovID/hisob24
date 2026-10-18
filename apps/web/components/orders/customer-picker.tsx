"use client"

import { useEffect, useId, useState } from "react"
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form"
import { Avatar } from "@/components/kit/avatar"
import { Badge } from "@/components/ui/badge"
import { customerName } from "@/lib/customers"
import { formatPhone, formatPhoneInput } from "@/lib/phone"
import { useCustomerSuggestions } from "@/lib/queries"
import type { Customer, CustomerType } from "@/lib/types"
import { cn } from "@/lib/utils"

// How many customers are suggested at most.
const SHOWN = 5

// CustomerPicker is the phone of a new order's customer, as the prototype's
// row (+998 __ ___ __ __), and, under it in the same group, the customers
// of the company whose phones begin with what was typed: three digits on,
// after a pause, five at most, each a row of its avatar, name, phone and
// type with «Tanlash». The arrow keys walk them, Enter or a click takes
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
          <div data-slot="form-row" data-invalid={fieldState.invalid || undefined} className="group">
            <div className="flex min-h-[52px] items-center gap-3 px-4 py-1">
              <label htmlFor={id} className="shrink-0 basis-[112px] text-[16px] leading-tight text-foreground group-data-invalid:text-destructive">
                Telefon raqami
              </label>
              <span className="text-base text-muted-foreground">+998</span>
              <input
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
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={fieldState.error ? `${id}-error` : undefined}
                disabled={disabled}
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80 disabled:opacity-60"
                {...field}
                value={field.value ?? ""}
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
            </div>
            {fieldState.error && (
              <p id={`${id}-error`} role="alert" data-slot="form-error" className="-mt-1.5 px-4 pb-2.5 text-xs text-destructive">
                {fieldState.error.message}
              </p>
            )}
            {shown && (
              <ul id={listId} role="listbox" aria-label="Mijoz takliflari" className="border-t-[0.5px] border-border">
                {items.map((customer, index) => {
                  const customerTitle = customerName(customer, typeOf(customer))
                  return (
                    <li
                      key={customer.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className={cn("flex min-h-12 cursor-default items-center gap-3 px-4 py-1.5", index === active && "bg-press")}
                      // The press must not take the focus (and the list) away
                      // before the click lands.
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => setActive(index)}
                      onClick={() => choose(customer)}
                    >
                      <Avatar name={customerTitle} className="size-8 text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{customerTitle ?? formatPhone(customer.phone)}</span>{" "}
                        <span className="block truncate text-sm text-muted-foreground">
                          {[customerTitle ? formatPhone(customer.phone) : null, typeOf(customer)?.name].filter(Boolean).join(" · ")}
                        </span>
                      </span>{" "}
                      <Badge variant="accent">Tanlash</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      }}
    />
  )
}
