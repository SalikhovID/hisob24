import { cn } from "@/lib/utils"
import { Logo } from "./logo"

// Brand is the panel's name: Hisob24's logo and the word that tells the
// panel from the user app. The space between them is a real one: whatever
// reads the name (a heading, a dialog's title) reads "Hisob24 Admin", two
// words; the gap that shows is the flex gap. It is sized by the font size it
// is given: both parts follow it.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.35em]", className)}>
      <Logo className="h-[1.1em]" />{" "}
      <span className="text-[0.85em] font-medium text-muted-foreground">Admin</span>
    </span>
  )
}
