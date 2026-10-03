"use client"

import { ArrowLeftRightIcon, LogOutIcon, MenuIcon, UserIcon } from "lucide-react"
import Link from "next/link"
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

// Topbar is the bar above every page of the app: on a phone the button that
// brings the sections out (the sidebar is hidden there) and the company's
// name, and on every screen who is signed in.
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const me = useMe()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Menyu" onClick={onMenuClick} className="md:hidden">
          <MenuIcon />
        </Button>
        <span className="truncate font-semibold md:hidden">{me.data?.company?.name ?? "Hisob24"}</span>
      </div>
      <div className="flex items-center gap-1">
        <ProfileMenu />
      </div>
    </header>
  )
}

// ProfileMenu is who is signed in (the name they go by in the company and
// their phone), the way to another company of theirs, when there is one that
// may be used, and the way out.
function ProfileMenu() {
  const me = useMe()
  const logout = useLogout()
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
        {user && <DropdownMenuSeparator />}
        {canSwitch && (
          <DropdownMenuItem render={<Link href="/select-company" />}>
            <ArrowLeftRightIcon />
            Kompaniyani almashtirish
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOutIcon />
          Chiqish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
