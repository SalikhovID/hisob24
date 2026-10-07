"use client"

import { ArrowLeftRightIcon, LogOutIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { unavailable } from "@/lib/companies"
import { formatPhone } from "@/lib/phone"
import { useLogout, useMe } from "@/lib/queries"
import { useMiniApp } from "@/lib/telegram"
import { LocationSwitcher } from "./location-switcher"

// Topbar is the bar above every page of the app: on a phone what heads the
// sidebar, Hisob24's logo over the company's name (the sidebar is hidden
// there, the sections are the tab bar's); on every screen the switch
// between the locations (when there are two or more), the theme button and
// who is signed in. Inside Telegram the chat sets the theme, so there is no
// theme button.
export function Topbar() {
  const me = useMe()
  const miniApp = useMiniApp()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <div className="min-w-0 shrink md:hidden">
        <Logo className="h-4" />
        <p className="h-5 truncate text-[0.8125rem] leading-5 font-medium">{me.data?.company?.name}</p>
      </div>
      {/* Between the company's name and the profile on a phone, at the
          left on a wide screen, where the sidebar names the company. */}
      <div className="flex min-w-0 flex-1 items-center justify-end md:justify-start">
        <LocationSwitcher />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!miniApp && <ThemeToggle />}
        <ProfileMenu />
      </div>
    </header>
  )
}

// ProfileMenu is who is signed in (the name they go by in the company and
// their phone), the way to another company of theirs, when there is one that
// may be used, and the way out. Inside Telegram there is no sign-out:
// closing the Mini App is the way out, and opening it signs the user in again.
function ProfileMenu() {
  const me = useMe()
  const logout = useLogout()
  const miniApp = useMiniApp()
  const user = me.data?.user
  const name = user ? (user.full_name ?? formatPhone(user.phone)) : null
  const canSwitch = (me.data?.companies ?? []).filter((company) => unavailable(company) === null).length > 1

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label="Profil" className="gap-2 px-2" />}>
        {name && <span className="hidden max-w-40 truncate font-medium sm:inline">{name}</span>}
        <UserIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              {user.full_name && <span className="block">{formatPhone(user.phone)}</span>}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        {user && (canSwitch || !miniApp) && <DropdownMenuSeparator />}
        {canSwitch && (
          <DropdownMenuItem render={<Link href="/select-company" />}>
            <ArrowLeftRightIcon />
            Kompaniyani almashtirish
          </DropdownMenuItem>
        )}
        {!miniApp && (
          <DropdownMenuItem variant="destructive" disabled={logout.isPending} onClick={() => logout.mutate()}>
            <LogOutIcon />
            Chiqish
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
