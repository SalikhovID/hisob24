"use client"

import Link from "next/link"
import { Avatar } from "@/components/kit/avatar"
import { HomeBanner } from "@/components/kit/banner"
import { Foot, Group, Row } from "@/components/kit/group"
import { tabIcons } from "@/components/kit/tab-icons"
import { sectionColors, TileIcon } from "@/components/kit/tile-icon"
import { LocationSwitcher } from "@/components/shell/location-switcher"
import { formatDate } from "@/lib/format"
import { useHomeScreenOffer } from "@/lib/home-screen"
import { shortName } from "@/lib/initials"
import { barItems, navFor } from "@/lib/nav"
import { formatPhone } from "@/lib/phone"
import { useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"

// Dashboard is the app's home, headed as the prototype's: who is signed in
// and where (the company, the short name and the role: the way to the
// profile) and the location switch; inside Telegram, the offer to put the
// app on the home screen; the sections the tab bar does not hold, a row
// away each (on a phone: a wide screen has them in the sidebar); and the
// subscription's end. The greeting is the page's heading for a screen
// reader. The shell around it shows it only to a session with a company.
export function Dashboard() {
  const me = useMe()
  const offer = useHomeScreenOffer()
  const data = me.data
  const company = data?.company
  if (!data || !company) return null
  const user = data.user
  const name = user.full_name ?? formatPhone(user.phone)
  const role = company.role === "owner" ? roleLabels.owner : (company.role_name ?? roleLabels.user)
  const { more } = barItems(navFor(data.permissions, data.nav_order))

  return (
    <>
      <h1 className="sr-only">Salom, {name}</h1>
      <div data-slot="home-head" className="mb-3 flex items-center justify-between gap-2.5 pt-1.5 pb-1">
        <Link
          href="/profile"
          className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-[22px] pr-2 text-left outline-none active:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar name={user.full_name} seed={user.phone} />
          <span className="min-w-0">
            <b className="block truncate text-md leading-tight font-semibold">{company.name}</b>{" "}
            <small className="block truncate text-xs text-muted-foreground">
              {user.full_name ? shortName(user.full_name) : name} · {role}
            </small>
          </span>
        </Link>
        <LocationSwitcher />
      </div>

      {offer.offered && <HomeBanner onAdd={offer.add} onDismiss={offer.dismiss} />}

      {more.length > 0 && (
        <Group label="Bo'limlar" inset="tile" className="md:hidden">
          {more.map((item) => {
            const Icon = tabIcons[item.key]
            return (
              <Row
                key={item.key}
                href={item.href}
                media={
                  <TileIcon color={sectionColors[item.key]}>
                    <Icon className="size-5" />
                  </TileIcon>
                }
                title={item.label}
              />
            )
          })}
        </Group>
      )}

      <Foot center>Obuna {formatDate(company.end_date)} gacha faol</Foot>
    </>
  )
}
