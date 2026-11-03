import { type LucideIcon, UserIcon } from "lucide-react"
import { avatarColor, firstLetter } from "@/lib/initials"
import { cn } from "@/lib/utils"

// Avatar is the mark beside a name, as the prototype draws it: the name's
// first letter, white on the name's own color (the same name always gets
// the same one), or a plain icon when there is no name to take it from.
// People are round, companies and products square (8px). One that is muted
// (someone no longer active) is grey, its letter in the hint's ink. 32px in
// a phone's rows, 30px on the web; a large one (a profile's head) 56px. It
// is decoration: the name itself is beside it, so assistive technology
// skips it.
export function Avatar({
  name,
  icon: Icon = UserIcon,
  square = false,
  size = "md",
  // letter: kept for the callers of before; every avatar shows a letter now.
  letter = false,
  muted = false,
  className,
}: {
  name: string | null | undefined
  icon?: LucideIcon
  square?: boolean
  size?: "md" | "lg"
  letter?: boolean
  muted?: boolean
  className?: string
}) {
  void letter
  const text = firstLetter(name)
  const colored = text !== null && !muted
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      data-size={size}
      data-square={square || undefined}
      style={colored ? { background: avatarColor(name ?? "") } : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center leading-none font-semibold select-none",
        size === "lg" ? "size-14 text-[23px]" : "size-8 text-[13px] md:size-[30px] md:text-[12.5px]",
        square ? "rounded-md" : "rounded-full",
        colored ? "text-white" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {text ?? <Icon className={size === "lg" ? "size-7" : "size-4"} />}
    </span>
  )
}
