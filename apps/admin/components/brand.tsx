import { Logo } from "./logo"

// Brand is the panel's name: Hisob24's logo and the word that tells the
// panel from the user app. The space between them is a real one: whatever
// reads the name (a heading, a dialog's title) reads "Hisob24 Admin", two
// words; the gap that shows is the flex gap.
export function Brand() {
  return (
    <span className="inline-flex items-center gap-[0.35em]">
      <Logo className="h-[1.1em]" />{" "}
      <span className="text-[0.85em] font-medium text-muted-foreground">Admin</span>
    </span>
  )
}
