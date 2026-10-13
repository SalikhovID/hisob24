import { type LucideIcon, UserIcon } from "lucide-react"
import { initials, tone } from "@/lib/initials"
import { cn } from "@/lib/utils"

// Avatar is the mark beside a name, as the prototype draws it: the initials
// on the gradient its seed (a phone, an ID) always gets (globals.css,
// data-tone), or a plain icon when there is no name to take them from. People
// are round, companies and products square; a product shows its first
// letter alone (letter). One that is muted (someone no longer active) keeps
// its initials and loses its tint. It is decoration: the name itself is
// beside it, so assistive technology skips it.
export function Avatar({
  name,
  seed,
  icon: Icon = UserIcon,
  square = false,
  size = "md",
  letter = false,
  muted = false,
  className,
}: {
  name: string | null | undefined
  seed: string | number
  icon?: LucideIcon
  square?: boolean
  size?: "md" | "lg"
  letter?: boolean
  muted?: boolean
  className?: string
}) {
  const text = letter ? (name ?? "").trim().charAt(0).toUpperCase() || null : initials(name)
  const tinted = text !== null && !muted
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      data-size={size}
      data-square={square || undefined}
      data-tone={tinted ? tone(seed) : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold leading-none tracking-[0.02em] select-none",
        size === "lg" ? "size-[88px] text-[32px]" : "size-10 text-[15px]",
        square ? (size === "lg" ? "rounded-[26px]" : "rounded-[12px]") : "rounded-full",
        tinted ? "text-white [text-shadow:0_1px_1px_rgba(0,0,0,.12)]" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {text ?? <Icon className={size === "lg" ? "size-9" : "size-5"} />}
    </span>
  )
}
