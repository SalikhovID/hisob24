"use client"

import { BuildingIcon, LogOutIcon, MapPinIcon, Repeat2Icon } from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar } from "@/components/kit/avatar"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Foot, Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { Segmented } from "@/components/kit/segmented"
import { TileIcon } from "@/components/kit/tile-icon"
import { unavailable } from "@/lib/companies"
import { formatDayMonth } from "@/lib/format"
import { useHomeScreenOffer } from "@/lib/home-screen"
import { formatPhone } from "@/lib/phone"
import { useLogout, useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { useMiniApp } from "@/lib/telegram"
import { useLocation } from "@/lib/use-location"

const themes = [
  { value: "system", label: "Tizim" },
  { value: "light", label: "Yorug'" },
  { value: "dark", label: "Qorong'i" },
]

// ProfilePage is who is signed in and where, as the prototype's «Profil»:
// the person (a large avatar, the name, the phone and the role), the
// company with till when its subscription runs and the way to another
// company of theirs, the location (with two or more, a list of radios),
// and in a browser the theme (Tizim, Yorug', Qorong'i side by side) and the
// way out. Inside Telegram the Mini App signs in by the Telegram account
// itself: there is no way out, and the chat sets the theme. The pages the
// tab bar does not hold, and the choice of the bar's own, are the settings
// page's.
export function ProfilePage() {
  const me = useMe()
  const miniApp = useMiniApp()
  const logout = useLogout()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const offer = useHomeScreenOffer()
  const data = me.data
  if (!data) return null
  const user = data.user
  const company = data.company
  const name = user.full_name ?? formatPhone(user.phone)
  const canSwitch = data.companies.filter((candidate) => unavailable(candidate) === null).length > 1
  const current = location.current
  const role = company ? (company.role === "owner" ? roleLabels.owner : (company.role_name ?? roleLabels.user)) : null

  return (
    <>
      <BackLink href="/settings" label="Sozlama" />
      <PageTitle title="Profil" />
      <div data-slot="profile-head" className="mb-6 grid justify-items-center gap-1 py-2 text-center">
        <Avatar name={user.full_name ?? name} size="lg" />
        <h2 className="mt-1.5 text-[18px] font-semibold">{name}</h2>
        <p className="text-md text-muted-foreground md:text-[13px]">{[formatPhone(user.phone), role].filter(Boolean).join(" · ")}</p>
      </div>
      {offer.offered && (
        <Group label="Bosh ekran">
          <li data-slot="row-item" className="px-4 pt-3.5 pb-3 md:px-3">
            <p className="text-base font-semibold">Hisob24&apos;ni bir bosishda oching</p>
            <p className="mt-1 text-md leading-snug">Ilovani bir zumda ochish uchun Hisob24&apos;ni bosh ekranga qo&apos;shing.</p>
          </li>
          <Row variant="link" onClick={offer.add} title="Qo'shish" />
          <Row variant="link" onClick={offer.dismiss} title="Yashirish" />
        </Group>
      )}
      {company && (
        <section>
          <SectionHeading>Kompaniya</SectionHeading>
          <div role="group" aria-label="Kompaniya">
            <Group as="dl">
              <KeyValue
                label="Kompaniya"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <BuildingIcon aria-hidden="true" strokeWidth={1.75} className="size-4 text-icon" />
                    {company.name}
                  </span>
                }
              />
              <KeyValue label="Obuna" value={`${formatDayMonth(company.end_date)} gacha faol`} />
            </Group>
            {canSwitch && (
              <Group className="-mt-4">
                <Row href="/select-company" media={<TileIcon icon={Repeat2Icon} />} title="Kompaniyani almashtirish" />
              </Group>
            )}
          </div>
        </section>
      )}
      {location.locations.length > 1 && current && (
        <section>
          <SectionHeading>Lokatsiya</SectionHeading>
          <Group>
            <div role="radiogroup" aria-label="Lokatsiya">
              {location.locations.map((candidate) => {
                const on = candidate.id === current.id
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => location.choose(candidate.id)}
                    data-slot="row"
                    className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-base outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:min-h-9 md:rounded-md md:px-3 md:hover:bg-ink-1"
                  >
                    <span
                      aria-hidden="true"
                      className={on ? "size-4 shrink-0 rounded-full bg-white shadow-[inset_0_0_0_5px_var(--primary)]" : "size-4 shrink-0 rounded-full bg-field shadow-[inset_0_0_0_1px_var(--ink-5)]"}
                    />
                    <MapPinIcon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-icon" />
                    <span className="min-w-0 truncate">{candidate.name}</span>
                  </button>
                )
              })}
            </div>
          </Group>
        </section>
      )}
      {!miniApp && (
        <section>
          <SectionHeading>Mavzu</SectionHeading>
          <Group className="p-3 md:p-3">
            <Segmented label="Mavzu" value={theme ?? "system"} onChange={setTheme} options={themes} className="mb-0 md:max-w-none" />
          </Group>
        </section>
      )}
      {miniApp ? (
        <Foot center>Mini App&apos;da chiqish yo&apos;q: Telegram akkauntingiz bilan avtomatik kirasiz.</Foot>
      ) : (
        <Group>
          <Row onClick={() => logout.mutate()} disabled={logout.isPending} media={<TileIcon icon={LogOutIcon} />} title="Chiqish" chevron={false} />
        </Group>
      )}
    </>
  )
}
