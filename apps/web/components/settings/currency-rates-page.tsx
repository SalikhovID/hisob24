"use client"

import { BanknoteIcon } from "lucide-react"
import { useState } from "react"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { isMulti, rateLine, useCurrencies, UZS } from "@/lib/currencies"
import { formatDateTime, formatRate } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useRates } from "@/lib/queries"
import type { CompanyCurrency, Rates } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { RatesDialog } from "./rates-dialog"

// rateOf is the rate of the currency in a row of the history.
function rateOf(row: Rates, currency: CompanyCurrency): string {
  return { USD: row.usd, EUR: row.eur, RUB: row.rub }[currency.code] ?? "0.0000"
}

// CurrencyRatesPage is the rates (logic/currencies.md, section 4), for
// whoever may see the settings, as the prototype's page: what each currency
// the company has on is worth now, the plus entering new rates
// (settings.edit), and the history of the rows entered, the newest first. A
// company in the so'm alone is told its admin turns the rest on.
export function CurrencyRatesPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const currencies = useCurrencies()
  const others = currencies.filter((c) => c.id !== UZS)
  const multi = isMulti(currencies)
  const [page, setPage] = useState(1)
  const history = useRates(multi ? companyId : null, page)
  const [entering, setEntering] = useState(false)

  if (!gate || companyId === null) return null
  return (
    <>
      <PageTitle
        title="Valyuta kurslari"
        description="Hujjatlar o'z sanasidagi kurs bilan so'mga aylantiriladi."
        back={{ href: "/settings", label: "Sozlamalar" }}
        action={multi && can(gate.permissions, "settings.edit") && <PlusButton label="Kurslarni yangilash" onClick={() => setEntering(true)} />}
      />
      {multi ? (
        <>
          <SectionHeading>Joriy kurslar</SectionHeading>
          <Group label="Joriy kurslar">
            {others.map((c) => (
              <Row key={c.id} title={`${c.code} — ${c.name}`} sub={rateLine(c)} />
            ))}
          </Group>
          <SectionHeading>Tarix</SectionHeading>
          {history.isPending && <ListLoading rows={2} mark="none" />}
          {history.isError && <Failed error={history.error} onRetry={() => history.refetch()} />}
          {history.data?.total === 0 && (
            <Group>
              <p className="px-4 py-3.5 text-md text-muted-foreground">Hali kurs kiritilmagan</p>
            </Group>
          )}
          {history.data && history.data.total > 0 && (
            <>
              <Group label="Kurslar tarixi">
                {history.data.items.map((row: Rates) => (
                  <Row
                    key={row.id}
                    title={formatDateTime(row.set_at)}
                    sub={row.set_by_name}
                    end={<span className="tabular-nums">{others.map((c) => `${c.code} ${formatRate(rateOf(row, c))}`).join(" · ")}</span>}
                  />
                ))}
              </Group>
              {history.data.total > history.data.page_size && (
                <Pager page={history.data.page} pageSize={history.data.page_size} total={history.data.total} onPage={setPage} />
              )}
            </>
          )}
          <Foot className="-mt-4">Kiritilgan kurslar, yangisi birinchi. Har hujjat o&apos;z sanasidagi kursni oladi.</Foot>
        </>
      ) : (
        <EmptyState icon={BanknoteIcon} title="Kompaniyada boshqa valyuta yo'q" description="Valyutani admin yoqadi. Yoqilgach, kurslari shu yerda kiritiladi." />
      )}
      {entering && <RatesDialog companyId={companyId} currencies={others} open onOpenChange={(open) => !open && setEntering(false)} />}
    </>
  )
}
