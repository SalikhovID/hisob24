"use client"

import { Columns3Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ColumnsMenu is where a user chooses which columns of the list to see: a
// tick beside each that shows. The menu stays open while columns are ticked
// and unticked, so several can be changed in one go.
export function ColumnsMenu({
  columns,
  hidden,
  onToggle,
}: {
  columns: { key: string; label: string }[]
  hidden: ReadonlySet<string>
  onToggle: (key: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-9 shrink-0 bg-card" />}>
        <Columns3Icon />
        Ustunlar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ko&apos;rinadigan ustunlar</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.key}
              checked={!hidden.has(column.key)}
              onCheckedChange={() => onToggle(column.key)}
              closeOnClick={false}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{column.label}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
