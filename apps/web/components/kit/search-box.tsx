"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// SearchBox is the prototype's search field: a 38px grey field on a phone,
// a 32px white one ringed by a hairline on the web (260px wide, the accent's
// ring round it while typing). It reports what was typed once
// typing pauses for delay ms (300 by default; 0 reports every keystroke, for
// a list that filters in place). The search it is given may also change from
// outside (a link to the bare list drops it from the address): the box then
// follows, so what was typed before is not taken for fresh typing and sent
// again. The × empties it at once.
export function SearchBox({
  value,
  onSearch,
  placeholder = "Ism yoki telefon",
  label = "Qidirish",
  delay = 300,
  className,
}: {
  value: string
  onSearch: (value: string) => void
  placeholder?: string
  label?: string
  delay?: number
  className?: string
}) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    // The box follows only if it agreed with the search before the change.
    // A box that is ahead of it is being typed in: the change is then its
    // own earlier report arriving, and what was typed since stays.
    if (text.trim() === seen) setText(value)
  }

  useEffect(() => {
    if (text.trim() === value) return
    if (delay === 0) {
      onSearch(text.trim())
      return
    }
    const timer = setTimeout(() => onSearch(text.trim()), delay)
    return () => clearTimeout(timer)
  }, [text, value, delay, onSearch])

  return (
    <div
      data-slot="search-box"
      className={cn(
        "mb-3 flex h-[38px] items-center gap-2 rounded-[10px] bg-(--search) px-2.5 text-icon shadow-(--search-rim) transition-shadow md:h-8 md:w-[260px] md:rounded-md md:focus-within:shadow-[inset_0_0_0_1px_var(--primary),0_0_0_3px_var(--primary-soft)]",
        className,
      )}
    >
      <SearchIcon aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {text !== "" && (
        <button
          type="button"
          aria-label="Tozalash"
          onClick={() => {
            setText("")
            onSearch("")
          }}
          className="-mr-1 grid size-7 shrink-0 place-items-center text-icon"
        >
          <XIcon strokeWidth={2} className="size-3.5" />
        </button>
      )}
    </div>
  )
}
