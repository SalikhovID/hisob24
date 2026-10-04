"use client"

import { SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"

// SearchInput reports what was typed once typing pauses for 300 ms.
export function SearchInput({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [text, setText] = useState(value)

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
