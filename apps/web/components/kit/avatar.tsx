import { type LucideIcon, UserIcon } from "lucide-react"
import { initials } from "@/lib/initials"
import { cn } from "@/lib/utils"

// Avatar is the mark beside a name, as the prototype draws it: the initials,
// dark on a plain grey circle, the same for everyone, or a plain icon when
// there is no name to take them from. People are round, companies and
// products square; a product shows its first letter alone (letter). One that
// is muted (someone no longer active) keeps its initials in the hint's ink.
// It is decoration: the name itself is beside it, so assistive technology
// skips it.
export function Avatar({
  name,
  icon: Icon = UserIcon,
  square = false,
  size = "md",
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
  const text = letter ? (name ?? "").trim().charAt(0).toUpperCase() || null : initials(name)
  const plain = text !== null && !muted
  return (
    <span
      aria-hidden="true"
      data-slot="avatar"
      data-size={size}
      data-square={square || undefined}
      className={cn(
        "flex shrink-0 items-center justify-center font-bold leading-none tracking-[0.02em] select-none",
        size === "lg" ? "size-[88px] text-[32px]" : "size-10 text-[15px]",
        square ? (size === "lg" ? "rounded-[26px]" : "rounded-[12px]") : "rounded-full",
        plain ? "bg-(--av-bg) text-(--av-ink)" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {text ?? <Icon className={size === "lg" ? "size-9" : "size-5"} />}
    </span>
  )
}
