"use client"

import { SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"

// SearchInput reports what was typed once typing pauses for 300 ms. The
// search it is given may also change from outside (a link to the bare list
// drops it from the address): the box then follows, so what was typed
// before is not taken for fresh typing and sent again.
export function SearchInput({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
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
    const timer = setTimeout(() => onSearch(text.trim()), 300)
    return () => clearTimeout(timer)
  }, [text, value, onSearch])

  return (
    <div className="relative w-full sm:w-72">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Qidirish"
        placeholder="Ism yoki telefon bo'yicha qidirish"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="h-9 bg-card pl-8"
      />
    </div>
  )
}
