import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// settingList frames a list of settings the way a table is framed: one
// border around the rows, a thin line between them.
export const settingList = "divide-y rounded-xl border bg-card"

// SettingRow is one line of a settings list: the name of what is set up
// (a type, a field, a dropdown, an option) with its marks beside it, a
// quieter line on what it holds, and at the end what can be done with it.
// A list that is put in order hands each row its drag handle.
export function SettingRow({
  handle,
  title,
  marks,
  detail,
  actions,
}: {
  handle?: ReactNode
  title: ReactNode
  marks?: ReactNode
  detail?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className={cn("flex items-center gap-1 py-2 pr-2 md:pr-3", handle ? "pl-1 md:pl-2" : "pl-4")}>
      {handle}
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span data-slot="setting-title" className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
            {title}
          </span>
          {marks}
        </div>
        {detail !== undefined && detail !== null && detail !== "" && (
          <p data-slot="setting-detail" className="text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {detail}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1 max-md:gap-2 pointer-coarse:gap-2">{actions}</div>}
    </div>
  )
}
