import type { ReactNode } from "react"
import { BrandLockup } from "@/components/kit/brand-mark"
import { cn } from "@/lib/utils"

// ShellLess is a screen with no shell around it (the company list, an
// expired subscription, the Mini App's sign-in and why it could not be): on
// a phone a column as tall as the screen, on a wide screen a card in the
// middle of the pale grey page, as the login's. The brand's lockup heads
// it (in a full-screen Mini App under what Telegram lays over the top), in
// the middle or, with start, at the left under what head holds (a way
// back); what it says stands under it. The splash goes without the lockup:
// its mark is Hisob24's.
export function ShellLess({ logo = true, start = false, head, children }: { logo?: boolean; start?: boolean; head?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh md:items-center md:justify-center md:bg-sidebar md:p-6">
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-4 pt-safe-6 pb-safe-6 md:mx-0 md:min-h-0 md:rounded-xl md:bg-card md:p-8 md:shadow-[0_0_0_1px_rgba(50,50,93,.06),0_24px_48px_-24px_rgba(50,50,93,.18)]">
        {head}
        {logo && <BrandLockup className={cn("shrink-0", start ? "self-start" : "mx-auto")} />}
        {children}
      </main>
    </div>
  )
}
