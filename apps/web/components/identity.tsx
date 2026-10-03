import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Avatar } from "./avatar"

// Identity is who or what a record is: an avatar, the title the record goes
// by and, when there is one, a line under it (a phone, a date, an ID). The
// avatar shows the initials of name, which is the title unless said
// otherwise: a title that is no name (a phone standing in for one) passes
// name as null and gets the icon.
export function Identity({
  title,
  subtitle,
  name,
  seed,
  icon,
}: {
  title: string
  subtitle?: ReactNode
  name?: string | null
  seed: string | number
  icon?: LucideIcon
}) {
  return (
    <span data-slot="identity" className="flex min-w-0 items-center gap-3">
      <Avatar name={name === undefined ? title : name} seed={seed} icon={icon} />
      <span className="grid min-w-0">
        <span data-slot="identity-title" className="truncate font-medium">
          {title}
        </span>
        {subtitle !== undefined && subtitle !== null && subtitle !== "" && (
          <span data-slot="identity-subtitle" className="truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
