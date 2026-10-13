"use client"

import { ArrowLeftRightIcon, BuildingIcon, MapPinIcon, MenuIcon, SunMoonIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Avatar } from "@/components/kit/avatar"
import { BackLink } from "@/components/kit/page-title"
import { DetailHead } from "@/components/kit/detail-head"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { tabIcons } from "@/components/kit/tab-icons"
import { sectionColors, TileIcon } from "@/components/kit/tile-icon"
import { RoleBadge } from "@/components/role-badge"
import { unavailable } from "@/lib/companies"
import { barItems, navFor } from "@/lib/nav"
import { formatPhone } from "@/lib/phone"
import { useLogout, useMe } from "@/lib/queries"
import { useMiniApp } from "@/lib/telegram"
import { useLocation } from "@/lib/use-location"

const themes = [
  { value: "system", label: "Tizim" },
  { value: "light", label: "Yorug'" },
  { value: "dark", label: "Qorong'i" },
]

// ProfilePage is who is signed in and where, as the prototype's profile: the
// person, the company they work in with their role, the location (with two
// or more) and the way to another company of theirs; the sections the tab
// bar does not hold; the order of the bar and, in a browser, the theme; and,
// in a browser, the way out. Inside Telegram closing the Mini App is the way
// out, and the chat sets the theme.
export function ProfilePage() {
  const me = useMe()
  const miniApp = useMiniApp()
  const logout = useLogout()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [sheet, setSheet] = useState<null | "location" | "theme">(null)
  const data = me.data
  if (!data) return null
  const user = data.user
  const company = data.company
  const name = user.full_name ?? formatPhone(user.phone)
  const { shown, more } = barItems(navFor(data.permissions, data.nav_order))
  const canSwitch = data.companies.filter((candidate) => unavailable(candidate) === null).length > 1
  const current = location.current

  return (
    <>
      <BackLink href="/" label="Bosh sahifa" />
      <DetailHead
        media={<Avatar name={user.full_name} seed={user.phone} size="lg" />}
        title={name}
        description={user.full_name ? formatPhone(user.phone) : undefined}
      />

      {company && (
        <>
          <SectionHeading>Kompaniya</SectionHeading>
          <Group label="Kompaniya" inset="tile">
            <Row media={<TileIcon icon={BuildingIcon} color={sectionColors.home} />} title={company.name} end={<RoleBadge role={company.role} name={company.role_name} />} />
            {location.locations.length > 1 && current && (
              <Row
                onClick={() => setSheet("location")}
                media={<TileIcon icon={MapPinIcon} color="#FF9500" />}
                title="Lokatsiya"
                end={<span className="text-muted-foreground">{current.name}</span>}
              />
            )}
            {canSwitch && <Row href="/select-company" media={<TileIcon icon={ArrowLeftRightIcon} color="#5856D6" />} title="Kompaniyani almashtirish" />}
          </Group>
        </>
      )}

      {more.length > 0 && (
        <>
          <SectionHeading>Bo&apos;limlar</SectionHeading>
          <Group label="Bo'limlar" inset="tile">
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
        </>
      )}

      <SectionHeading>Ilova</SectionHeading>
      <Group label="Ilova" inset="tile">
        <Row
          href="/profile/menu"
          media={<TileIcon icon={MenuIcon} color="#34C759" />}
          title="Pastki menyu"
          end={<span className="text-muted-foreground">{shown.length} ta bo&apos;lim</span>}
        />
        {!miniApp && (
          <Row
            onClick={() => setSheet("theme")}
            media={<TileIcon icon={SunMoonIcon} color="#007AFF" />}
            title="Mavzu"
            end={<span className="text-muted-foreground">{themes.find((candidate) => candidate.value === theme)?.label ?? "Tizim"}</span>}
          />
        )}
      </Group>

      <Foot>
        Hisob24 — biznesingiz uchun hisob tizimi.
        {miniApp && " Telegram ichida chiqish uchun ilovani yoping."}
      </Foot>

      {!miniApp && (
        <Group>
          <Row variant="danger" onClick={() => logout.mutate()} disabled={logout.isPending} title="Chiqish" />
        </Group>
      )}

      {current && (
        <ActionSheet
          open={sheet === "location"}
          onOpenChange={(open) => setSheet(open ? "location" : null)}
          title="Lokatsiya"
          items={location.locations.map((candidate) => ({
            label: candidate.name,
            checked: candidate.id === current.id,
            onSelect: () => location.choose(candidate.id),
          }))}
        />
      )}
      <ActionSheet
        open={sheet === "theme"}
        onOpenChange={(open) => setSheet(open ? "theme" : null)}
        title="Mavzu"
        items={themes.map((candidate) => ({ label: candidate.label, checked: candidate.value === (theme ?? "system"), onSelect: () => setTheme(candidate.value) }))}
      />
    </>
  )
}
