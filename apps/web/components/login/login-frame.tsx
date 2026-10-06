import type { ReactNode } from "react"
import { Logo24 } from "@/components/logo"
import { cn } from "@/lib/utils"

// LoginFrame is the login's page: the brand's panel and, in the page's main
// part, what is asked for. On a phone the panel is a band across the top and
// the rest a sheet drawn over its lower edge; from lg up the two stand side
// by side, each as tall as the screen. brand heads the page (the h1 holds
// it), tagline says what the product is: a line under the brand on a phone,
// the panel's large type on a wide screen, set in a narrow measure so that it
// breaks into two or three lines. The panel's backdrop is the mark's
// number, far larger than the panel and cut by its edge. On the panel the
// brand's color and the quiet text's are the panel's own foreground, as they
// are white in the dark: whatever stands there (the logo, the word beside
// it, the tagline) needs no variant of its own. In a Mini App opened full
// screen the panel's top padding grows by what Telegram lays over the top
// (pt-safe-*), so the brand stays clear of the status bar and the controls.
export function LoginFrame({ brand, tagline, children }: { brand: ReactNode; tagline: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <header
        className={cn(
          "relative isolate overflow-hidden bg-brand-panel px-6 pt-safe-10 pb-16 text-brand-panel-foreground",
          "[--brand:var(--brand-panel-foreground)] [--muted-foreground:color-mix(in_oklab,var(--brand-panel-foreground)_72%,transparent)]",
          "lg:flex lg:flex-col lg:justify-between lg:p-12 lg:pt-safe-12",
        )}
      >
        <Logo24 className="pointer-events-none absolute -right-16 bottom-0 -z-10 h-[110%] opacity-[0.07] lg:top-1/2 lg:-right-20 lg:bottom-auto lg:h-auto lg:w-[105%] lg:-translate-y-1/2" />
        <h1 className="flex">{brand}</h1>
        <p className="mt-2 text-sm text-muted-foreground lg:mt-0 lg:max-w-[14ch] lg:text-4xl lg:leading-[1.1] lg:font-semibold lg:tracking-tight lg:text-brand-panel-foreground">
          {tagline}
        </p>
      </header>
      <main className="relative -mt-6 flex flex-1 flex-col rounded-t-3xl bg-background px-6 pt-8 pb-10 lg:mt-0 lg:justify-center lg:rounded-none lg:px-12">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
