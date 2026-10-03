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
// badge such as "Siz") stands beside the title, outside it. A long title
// wraps; it is never cut short, and the line of figures under it never
// breaks.
export function Identity({
  title,
  subtitle,
  name,
  seed,
  icon,
  square,
  href,
  mark,
}: {
  title: string
  subtitle?: ReactNode
  name?: string | null
  seed: string | number
  icon?: LucideIcon
  square?: boolean
  href?: string
  mark?: ReactNode
}) {
  return (
    <span data-slot="identity" className="flex min-w-0 items-center gap-3">
      <Avatar name={name === undefined ? title : name} seed={seed} icon={icon} square={square} />
      <span className="flex min-h-10 min-w-0 flex-col justify-center">
        <span className="flex min-w-0 items-center gap-2">
          <span data-slot="identity-title" className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
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
          <span
            data-slot="identity-subtitle"
            className="text-[0.8125rem] leading-5 font-normal whitespace-nowrap text-muted-foreground"
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
