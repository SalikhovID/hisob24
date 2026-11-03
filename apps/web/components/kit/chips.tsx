"use client"

import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const strip = "-mx-4 mb-3.5 flex gap-1.5 overflow-x-auto px-4 py-0.5 scrollbar-hide md:mx-0 md:px-0"

// A chip is the prototype's: on a phone a white 32px pill of 15px words, on
// the web a 28px one of 12.5px ringed by a hairline; on, it is the accent on
// a phone and the ink on the web.
export const chip =
  "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-[15px] font-medium whitespace-nowrap text-foreground outline-none transition-colors after:absolute after:-inset-x-0.5 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 md:h-7 md:px-3 md:text-[12.5px]"
export const chipOff = "bg-card md:shadow-[0_0_0_1px_var(--ink-4)] md:hover:bg-ink-1"
export const chipOn = "bg-primary text-primary-foreground md:bg-foreground md:text-background"

// Chips is the strip of filters under a search: it scrolls sideways, out to
// the page's edges on a phone (inside the page's column on a wide screen),
// rather than squeezing.
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
    <button type="button" aria-pressed={pressed} data-slot="chip" onClick={onClick} className={cn(chip, pressed ? chipOn : chipOff, className)}>
      {children}
      {count !== undefined && (
        <>
          {" "}
          <span data-slot="chip-count" className="font-medium opacity-60">
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
  // orders' «Mas'ul» and «Bosqich» beside the types).
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
          className={cn(
            chip,
            "not-data-checked:bg-card md:not-data-checked:shadow-[0_0_0_1px_var(--ink-4)] md:not-data-checked:hover:bg-ink-1 data-checked:bg-primary data-checked:text-primary-foreground md:data-checked:bg-foreground md:data-checked:text-background",
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <>
              {" "}
              <span data-slot="chip-count" className="font-medium opacity-60">
                {option.count}
              </span>
            </>
          )}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
