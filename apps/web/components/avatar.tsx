import { initials, tone } from "@/lib/initials"
import { cn } from "@/lib/utils"

// The tints an avatar may have, one per tone. Whole class names: Tailwind
// finds classes by reading the source, so they cannot be put together.
const tints = [
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
]

// Avatar is the round mark beside a name: its initials, in the tint its seed
// (a phone, an ID) always gets. It is decoration: the name itself is beside
// it, so assistive technology skips it.
export function Avatar({
  name,
  seed,
  className,
}: {
  name: string | null | undefined
  seed: string | number
  className?: string
}) {
  const place = tone(seed)
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      data-tone={place}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium select-none",
        tints[place],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
