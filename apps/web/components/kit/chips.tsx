"use client"

import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const strip = "-mx-4 mb-3.5 flex gap-1.5 overflow-x-auto px-4 py-0.5 scrollbar-hide"

const chip =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-md font-medium whitespace-nowrap text-heading outline-none transition-colors after:absolute after:-inset-x-0.5 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50"
const on = "bg-primary-soft font-semibold text-primary"

// Chips is the strip of filters under a search: it scrolls sideways, out to
// the page's edges, rather than squeezing.
export function Chips({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} data-slot="chips" className={cn(strip, className)}>
      {children}
    </div>
  )
}

// Chip is one filter that is on or off (a toggle), or one that opens a
// picker (with a chevron); a count may stand beside its name.
export function Chip({
  pressed,
  onClick,
  count,
  chevron = false,
  children,
  className,
}: {
  pressed?: boolean
  onClick: () => void
  count?: number
  chevron?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <button type="button" aria-pressed={pressed} data-slot="chip" onClick={onClick} className={cn(chip, pressed && on, className)}>
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span data-slot="chip-count" className="font-medium text-muted-foreground">
            {count}
          </span>
        </>
      )}
      {chevron && <ChevronDownIcon aria-hidden="true" strokeWidth={2.4} className="size-4 opacity-70" />}
    </button>
  )
}

// ChoiceChips are one choice among several (every type, one type): radios
// drawn as chips. A chip's name includes its count ("Jismoniy 8").
export function ChoiceChips({
  label,
  value,
  onChange,
  options,
  bare = false,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; count?: number }[]
  // bare drops the strip: the radios stand in a strip of more filters (the
  // tasks' «Mas'ul» and «Bosqich» beside the types).
  bare?: boolean
  className?: string
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(String(next))}
      data-slot="chips"
      className={cn(bare ? "flex shrink-0 gap-1.5" : strip, className)}
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          data-slot="chip"
          className={cn(chip, "data-checked:bg-primary-soft data-checked:font-semibold data-checked:text-primary")}
        >
          {option.label}
          {option.count !== undefined && (
            <>
              {" "}
              <span data-slot="chip-count" className="font-medium text-muted-foreground">
                {option.count}
              </span>
            </>
          )}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
