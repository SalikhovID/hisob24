import { LogoMark } from "@/components/logo"
import { cn } from "@/lib/utils"

// BrandMark is the prototype's brand square at the head of the sidebar:
// the designer's H24 mark (2026-10-04 logo rules) white on the brand's teal
// square, 22px. It is decoration: a name stands beside it, or the button it
// is in has one.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" data-slot="brand-mark" className={cn("grid size-[22px] shrink-0 place-items-center rounded-[5px] bg-brand-mark text-white", className)}>
      <LogoMark className="h-auto w-[15px] text-white" />
    </span>
  )
}
