import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// settingList frames a list of settings the way a table is framed: one
// border around the rows, a thin line between them.
export const settingList = "divide-y rounded-xl border bg-card"

// thumb makes an icon button big enough for a thumb where there is no
// pointer: 36px to see, 44px to hit.
const thumb =
  "max-md:relative max-md:size-9 max-md:after:absolute max-md:after:-inset-1 pointer-coarse:relative pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1"

// iconAction and iconDanger style the icon buttons at a row's end: quiet
// until pointed at, the one that deletes in red.
export const iconAction = `text-muted-foreground hover:text-foreground ${thumb}`
export const iconDanger = `text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 ${thumb}`

// SettingRow is one line of a settings list: the name of what is set up
// (a type, a field, a dropdown, an option, a stage) with its marks beside
// it, a quieter line on what it holds, and at the end what can be done with
// it. A list that is put in order hands each row its drag handle; lead is
// what stands before the name (a stage's color).
export function SettingRow({
  handle,
  lead,
  title,
  marks,
  detail,
  actions,
}: {
  handle?: ReactNode
  lead?: ReactNode
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
          {lead}
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
