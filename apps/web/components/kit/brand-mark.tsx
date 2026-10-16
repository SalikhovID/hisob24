import { LogoMark } from "@/components/logo"
import { cn } from "@/lib/utils"

// BrandMark is the prototype's brand square beside a page's title and at
// the head of the sidebar: the designer's H24 mark (2026-10-04 logo rules)
// on the glossy accent, in the accent's other end (white on the light's
// black, black on the dark's white). It is decoration: a name stands beside
// it, or the button it is in has one.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" data-slot="brand-mark" className={cn("grid size-10 shrink-0 place-items-center rounded-[12px] glossy", className)}>
      <LogoMark className="h-auto w-[27px] text-primary-foreground" />
    </span>
  )
}
