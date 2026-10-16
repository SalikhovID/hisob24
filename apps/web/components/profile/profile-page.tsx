"use client"

import { ArrowLeftRightIcon, BuildingIcon, MapPinIcon, SunMoonIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Avatar } from "@/components/kit/avatar"
import { BackLink } from "@/components/kit/page-title"
import { DetailHead } from "@/components/kit/detail-head"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { TileIcon } from "@/components/kit/tile-icon"
import { RoleBadge } from "@/components/role-badge"
import { unavailable } from "@/lib/companies"
import { useHomeScreenOffer } from "@/lib/home-screen"
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
// or more) and the way to another company of theirs; in a browser, the
// theme and the way out. Inside Telegram closing the Mini App is the way
// out, and the chat sets the theme. The pages the tab bar does not hold,
// and the bar's own, are «Sozlama»'s.
export function ProfilePage() {
  const me = useMe()
  const miniApp = useMiniApp()
  const logout = useLogout()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const offer = useHomeScreenOffer()
  const [sheet, setSheet] = useState<null | "location" | "theme">(null)
  const data = me.data
  if (!data) return null
  const user = data.user
  const company = data.company
  const name = user.full_name ?? formatPhone(user.phone)
  const canSwitch = data.companies.filter((candidate) => unavailable(candidate) === null).length > 1
  const current = location.current

  return (
    <>
      <BackLink href="/" label="Bosh sahifa" />
      <DetailHead
        media={<Avatar name={user.full_name} size="lg" />}
        title={name}
        description={user.full_name ? formatPhone(user.phone) : undefined}
      />

      {offer.offered && (
        <Group label="Bosh ekran">
          <li data-slot="row-item" className="px-4 pt-3.5 pb-3">
            <p className="text-base font-semibold">Hisob24&apos;ni bir bosishda oching</p>
            <p className="mt-1 text-md leading-snug">Ilovani bir zumda ochish uchun Hisob24&apos;ni bosh ekranga qo&apos;shing.</p>
          </li>
          <Row variant="link" onClick={offer.add} title="Qo'shish" />
          <Row variant="link" onClick={offer.dismiss} title="Yashirish" />
        </Group>
      )}

      {company && (
        <>
          <SectionHeading>Kompaniya</SectionHeading>
          <Group label="Kompaniya" inset="tile">
            <Row media={<TileIcon icon={BuildingIcon} />} title={company.name} end={<RoleBadge role={company.role} name={company.role_name} />} />
            {location.locations.length > 1 && current && (
              <Row
                onClick={() => setSheet("location")}
                media={<TileIcon icon={MapPinIcon} />}
                title="Lokatsiya"
                end={<span className="text-muted-foreground">{current.name}</span>}
              />
            )}
            {canSwitch && <Row href="/select-company" media={<TileIcon icon={ArrowLeftRightIcon} />} title="Kompaniyani almashtirish" />}
          </Group>
        </>
      )}

      {!miniApp && (
        <>
          <SectionHeading>Ilova</SectionHeading>
          <Group label="Ilova" inset="tile">
            <Row
              onClick={() => setSheet("theme")}
              media={<TileIcon icon={SunMoonIcon} />}
              title="Mavzu"
              end={<span className="text-muted-foreground">{themes.find((candidate) => candidate.value === theme)?.label ?? "Tizim"}</span>}
            />
          </Group>
        </>
      )}

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
