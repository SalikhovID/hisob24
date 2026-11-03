import type { ReactNode } from "react"

// LoginFrame is the login's page as the prototype draws it: a card in the
// middle of the pale grey page (820px at most, 12px round, floating), the
// brand's panel at its left (the ink in the light, near white in the
// night; the brand and a line on what the product is at its foot) and what
// is asked for at its right. On a phone the panel stands over the form.
// brand heads the page (the h1 holds it). On the panel the brand's color
// and the quiet text's are the panel's own foreground: whatever stands
// there needs no variant of its own. In a Mini App opened full screen the
// page's top padding grows by what Telegram lays over the top (pt-safe-*),
// so the card stays clear of the status bar and the controls.
export function LoginFrame({ brand, tagline, children }: { brand: ReactNode; tagline: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-sidebar px-4 pt-safe-4 pb-4 md:p-6">
      <div
        data-slot="login-card"
        className="grid w-full max-w-[820px] overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_rgba(50,50,93,.06),0_24px_48px_-24px_rgba(50,50,93,.18)] md:min-h-[440px] md:grid-cols-2"
      >
        <header className="grid content-end gap-2 bg-brand-panel p-6 text-brand-panel-foreground [--brand:var(--brand-panel-foreground)] [--muted-foreground:color-mix(in_oklab,var(--brand-panel-foreground)_70%,transparent)] md:p-8">
          <h1 className="flex">{brand}</h1>
          <p className="max-w-[300px] text-[14px] text-muted-foreground">{tagline}</p>
        </header>
        <main className="grid content-center gap-3.5 bg-card p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
