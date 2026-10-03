import { type LucideIcon, UserIcon } from "lucide-react"
import { initials, tone } from "@/lib/initials"
import { cn } from "@/lib/utils"

// The tints an avatar may have, one per tone. None is a hue that means
// something elsewhere: green, amber and red are statuses, indigo is the
// brand and the owner's mark. Whole class names: Tailwind finds classes by
// reading the source, so they cannot be put together.
const tints = [
  "bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-300",
  "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
  "bg-slate-500/15 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
]

// Avatar is the mark beside a name: its initials, in the tint its seed (a
// phone, an ID) always gets, or a plain icon when there is no name to take
// them from. People are round, companies square. It is decoration: the name
// itself is beside it, so assistive technology skips it.
export function Avatar({
  name,
  seed,
  icon: Icon = UserIcon,
  square = false,
  className,
}: {
  name: string | null | undefined
  seed: string | number
  icon?: LucideIcon
  square?: boolean
  className?: string
}) {
  const letters = initials(name)
  const place = tone(seed)
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      data-tone={place}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center text-xs leading-none font-semibold select-none",
        square ? "rounded-lg" : "rounded-full",
        letters ? tints[place] : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {letters ?? <Icon className="size-4" />}
    </span>
  )
}
