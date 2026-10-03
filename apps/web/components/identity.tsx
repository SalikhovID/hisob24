import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Avatar } from "./avatar"

// Identity is who or what a record is: an avatar, the title the record goes
// by and, when there is one, a line under it (a phone, a date, an ID). The
// avatar shows the initials of name, which is the title unless said
// otherwise: a title that is no name (a phone standing in for one) passes
// name as null and gets the icon. With href the title is the record's link:
// the title alone, so the link is named by it and nothing else, yet the
// whole identity answers the pointer (a name alone is a small thing to hit
// with a thumb). A mark (a badge such as "Siz") stands beside the title,
// outside it. A muted identity (someone no longer active) steps back: its
// title takes the color of the line under it and its avatar loses its tint.
// A long title wraps; it is never cut short, and the line of figures under
// it never breaks.
export function Identity({
  title,
  subtitle,
  name,
  seed,
  icon,
  square,
  href,
  mark,
  muted,
}: {
  title: string
  subtitle?: ReactNode
  name?: string | null
  seed: string | number
  icon?: LucideIcon
  square?: boolean
  href?: string
  mark?: ReactNode
  muted?: boolean
}) {
  return (
    <span data-slot="identity" className="relative flex min-w-0 items-center gap-3">
      <Avatar name={name === undefined ? title : name} seed={seed} icon={icon} square={square} muted={muted} />
      <span className="flex min-h-10 min-w-0 flex-col justify-center">
        <span className="flex min-w-0 items-center gap-2">
          <span
            data-slot="identity-title"
            className={cn("min-w-0 text-sm font-medium [overflow-wrap:anywhere]", muted && "text-muted-foreground")}
          >
            {href ? (
              <Link href={href} className="rounded-sm underline-offset-4 after:absolute after:inset-0 hover:underline">
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
