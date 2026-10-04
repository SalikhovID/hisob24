import type { ReactNode } from "react"
import { Brand } from "@/components/brand"
import { NavLinks } from "./nav-links"
import { Topbar } from "./topbar"

// AppShell frames every page after login: the sections in a sidebar on wide
// screens (in the top bar's menu on phones), the top bar and the page.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-sidebar p-3 lg:block">
        <Brand className="mb-4 flex px-3 py-2 text-lg" />
        <NavLinks />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="w-full flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
