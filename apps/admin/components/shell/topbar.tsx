"use client"

import { useMutation } from "@tanstack/react-query"
import { LogOutIcon, MenuIcon, MoonIcon, SunIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { api, call } from "@/lib/api"
import { useMe } from "@/lib/queries"
import { useMiniApp } from "@/lib/telegram"
import { NavLinks } from "./nav-links"

// Topbar is the bar above every page: on a phone the menu with the
// sections (the sidebar on wider screens), who is signed in and the way out.
// Inside Telegram there is no sign-out: closing the Mini App is the way out,
// and opening it signs the admin in again.
export function Topbar() {
  const router = useRouter()
  const me = useMe()
  const miniApp = useMiniApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const logout = useMutation({
    mutationFn: () => call(api.POST("/admin/auth/logout")),
    onSuccess: () => router.replace("/login"),
  })

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menyu" className="lg:hidden" />}>
          <MenuIcon />
        </SheetTrigger>
        <SheetContent side="left" className="bg-sidebar p-3">
          <SheetHeader className="px-1">
            <SheetTitle>Hisob24 Admin</SheetTitle>
          </SheetHeader>
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <span className="font-semibold lg:hidden">Hisob24 Admin</span>
      <div className="ml-auto flex min-w-0 items-center gap-1">
        {me.data && (
          <span className="mr-1 truncate text-sm text-muted-foreground">
            {me.data.full_name ?? me.data.telegram_id}
          </span>
        )}
        {!miniApp && <ThemeToggle />}
        {!miniApp && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chiqish"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOutIcon />
          </Button>
        )}
      </div>
    </header>
  )
}

// ThemeToggle switches light and dark; both icons render and CSS shows the
// right one, so the server's HTML matches whatever theme the browser picks.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Mavzuni almashtirish"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </Button>
  )
}
