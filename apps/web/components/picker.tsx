"use client"

import { XIcon } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// PickerItem is one thing a picker offers: by its name, with a line of
// detail beside it (a phone, a unit and a price).
export interface PickerItem {
  id: number
  name: string
  meta?: string
}

// How many items are offered at most.
const SHOWN = 5

// Picker is a field that finds a record by its name: what is typed is told
// to the parent (onTyped), which brings the matches (items); they stand
// under the field, five at most, the arrow keys walk them, Enter or a click
// takes one (onSelect), Escape puts them away. The one taken stands in the
// field's place as a chip, with its detail and an × that clears it
// (onClear). error is told under the field.
export function Picker({
  label,
  placeholder,
  listLabel,
  typed,
  onTyped,
  items,
  selected,
  onSelect,
  onClear,
  error,
  disabled,
}: {
  label: string
  placeholder: string
  listLabel: string
  typed: string
  onTyped: (text: string) => void
  items: PickerItem[]
  selected: PickerItem | null
  onSelect: (item: PickerItem) => void
  onClear: () => void
  error?: string
  disabled?: boolean
}) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const offered = items.slice(0, SHOWN)
  const shown = open && !disabled && typed.length > 0 && offered.length > 0
  const errors = error ? [{ message: error }] : undefined

  // Taking an item empties the field: the next search starts afresh.
  const choose = (item: PickerItem) => {
    setOpen(false)
    setActive(-1)
    onTyped("")
    onSelect(item)
  }

  if (selected) {
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel>{label}</FieldLabel>
        <div role="group" aria-label={label} className="flex h-9 items-center gap-2 rounded-lg border bg-muted/40 pr-1 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
          {selected.meta && <span className="truncate text-muted-foreground tabular-nums">{selected.meta}</span>}
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`${label}: bekor qilish`} disabled={disabled} onClick={onClear}>
            <XIcon />
          </Button>
        </div>
        <FieldError errors={errors} />
      </Field>
    )
  }

  return (
    <Field data-invalid={error ? true : undefined} className="relative">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={typed}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onChange={(event) => {
          onTyped(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={(event) => {
          if (disabled) return
          switch (event.key) {
            case "ArrowDown":
              if (offered.length === 0) return
              event.preventDefault()
              setOpen(true)
              setActive((current) => Math.min(current + 1, offered.length - 1))
              return
            case "ArrowUp":
              if (!shown) return
              event.preventDefault()
              setActive((current) => Math.max(current - 1, 0))
              return
            case "Enter":
              if (!shown || active < 0) return
              event.preventDefault()
              choose(offered[active])
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
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border bg-popover py-1 text-sm text-popover-foreground shadow-md"
        >
          {offered.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cn("flex cursor-default items-baseline gap-2 px-3 py-1.5", index === active && "bg-accent text-accent-foreground")}
              // The press must not take the focus (and the list) away
              // before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(item)}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
              {item.meta && <span className="whitespace-nowrap text-muted-foreground tabular-nums">{item.meta}</span>}
            </li>
          ))}
        </ul>
      )}
      <FieldError errors={errors} />
    </Field>
  )
}
