import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Avatar } from "./avatar"

// Identity is who or what a record is: an avatar, the title the record goes
// by and, when there is one, a line under it (a phone, a date, an ID). The
// avatar shows the initials of name, which is the title unless said
// otherwise: a title that is no name (a phone standing in for one) passes
// name as null and gets the icon. With href the title is the record's link:
// the title alone, so the link is named by it and nothing else. A mark (a
// badge such as "Siz") stands beside the title, outside it.
export function Identity({
  title,
  subtitle,
  name,
  seed,
  icon,
  href,
  mark,
}: {
  title: string
  subtitle?: ReactNode
  name?: string | null
  seed: string | number
  icon?: LucideIcon
  href?: string
  mark?: ReactNode
}) {
  return (
    <span data-slot="identity" className="flex min-w-0 items-center gap-3">
      <Avatar name={name === undefined ? title : name} seed={seed} icon={icon} />
      <span className="grid min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span data-slot="identity-title" className="truncate font-medium">
            {href ? (
              <Link href={href} className="underline-offset-4 hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </span>
          {mark}
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
