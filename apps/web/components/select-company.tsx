"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Avatar } from "@/components/kit/avatar"
import { Foot, Group, Row } from "@/components/kit/group"
import { BackLink } from "@/components/kit/page-title"
import { ShellLess } from "@/components/shell-less"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { subscriptionExpired } from "@/lib/api"
import { unavailable } from "@/lib/companies"
import { useLogout, useMe, useSwitchCompany } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { useMiniApp } from "@/lib/telegram"

// SelectCompany lets someone in several companies choose the one to work
// in, as the prototype's company list: Hisob24's logo, the heading, a row
// per company (its square avatar, the role in it) and, for one that cannot
// be worked in, why, dimmed. Reached from the app (the profile), the
// company the session works in is marked «Joriy» and the page leads back.
export function SelectCompany() {
  const router = useRouter()
  const me = useMe()
  const choose = useSwitchCompany()
  const logout = useLogout()
  const miniApp = useMiniApp()
  // The session's company has expired since it was chosen: /expired offers
  // the way back to this list.
  const expired = subscriptionExpired(me.error)

  useEffect(() => {
    if (expired) router.replace("/expired")
  }, [expired, router])

  const current = me.data?.company?.id ?? null
  const companies = me.data?.companies ?? []

  return (
    <ShellLess start head={current !== null && <BackLink href="/profile" label="Profil" />}>
      <h1 className="mt-5 text-[20px] leading-[1.3] font-semibold">Kompaniyani tanlang</h1>
      <p className="mt-1 mb-5 text-[13px] text-muted-foreground">Qaysi kompaniyada ishlaysiz?</p>
      {me.isPending ? (
        <ListLoading rows={2} mark="square" />
      ) : me.isError ? (
        !expired && <Failed error={me.error} onRetry={() => me.refetch()} />
      ) : (
        <>
          {choose.isError && (
            <p role="alert" className="mb-3 text-md text-destructive">
              {choose.error.message}
            </p>
          )}
          <Group label="Kompaniyalar" inset="icon">
            {companies.map((company) => {
              const reason = unavailable(company)
              return (
                <Row
                  key={company.id}
                  onClick={() => choose.mutate(company.id, { onSuccess: () => router.replace("/") })}
                  disabled={reason !== null || choose.isPending}
                  className={reason ? "opacity-55" : undefined}
                  media={<Avatar name={company.name} square />}
                  title={company.name}
                  sub={roleLabels[company.role]}
                  end={
                    reason ? (
                      <Badge variant={reason.expired ? "red" : "neutral"}>{reason.label}</Badge>
                    ) : company.id === current ? (
                      <Badge variant="accent">Joriy</Badge>
                    ) : undefined
                  }
                  chevron={reason === null && company.id !== current}
                />
              )
            })}
          </Group>
          {companies.some((company) => unavailable(company) !== null) && (
            <Foot>Muddati o&apos;tgan yoki bloklangan kompaniyani tanlab bo&apos;lmaydi.</Foot>
          )}
          {companies.every((company) => unavailable(company) !== null) && (
            <EmptyState
              title="Faol kompaniya yo'q"
              description="Kompaniyangiz obunasi tugagan yoki bloklangan. Davom etish uchun administrator bilan bog'laning."
            />
          )}
        </>
      )}
      {!miniApp && (
        <Group className="mt-auto">
          <Row variant="danger" onClick={() => logout.mutate()} disabled={logout.isPending} title="Chiqish" />
        </Group>
      )}
    </ShellLess>
  )
}
