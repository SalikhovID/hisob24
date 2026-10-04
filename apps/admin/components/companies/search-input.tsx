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
    // What the box itself reported comes back as value: it stays as typed.
    if (value !== text.trim()) setText(value)
  }

  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => onSearch(text.trim()), 300)
    return () => clearTimeout(timer)
  }, [text, value, onSearch])

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Qidirish"
        placeholder="Nomi bo'yicha qidirish"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="h-9 bg-card pl-8"
      />
    </div>
  )
}
