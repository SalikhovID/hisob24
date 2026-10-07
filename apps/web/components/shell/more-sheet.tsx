"use client"

import { SlidersHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { isCurrentItem, type NavItem } from "@/lib/nav"
import { cn } from "@/lib/utils"

// MoreSheet is «Yana» of the tab bar: the sections that did not fit in it,
// in a list that comes up from the bottom of a phone, and the way to put
// the sections in one's own order. A section chosen closes it.
export function MoreSheet({
  items,
  open,
  onOpenChange,
  onCustomize,
}: {
  items: NavItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCustomize: () => void
}) {
  const pathname = usePathname()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 pb-safe">
        <SheetHeader>
          <SheetTitle>Yana</SheetTitle>
        </SheetHeader>
        <nav aria-label="Qolgan bo'limlar" className="flex flex-col px-2 pb-2">
          {items.map((item) => {
            const current = isCurrentItem(item, pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  current && "bg-accent text-accent-foreground",
                )}
              >
                <Icon strokeWidth={current ? 2.5 : 1.5} className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-2">
          <Button type="button" variant="ghost" className="h-11 w-full justify-start gap-3 px-3 font-medium" onClick={onCustomize}>
            <SlidersHorizontalIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            Menyuni sozlash
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
