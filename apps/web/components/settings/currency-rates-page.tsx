"use client"

import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { isMulti, rateLine, useCurrencies, UZS } from "@/lib/currencies"
import { formatDateTime, formatRate } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useRates } from "@/lib/queries"
import type { CompanyCurrency, Permission, Rates } from "@/lib/types"
import { RatesDialog } from "./rates-dialog"
import { Section } from "./section"
import { SettingRow, settingList } from "./setting-row"

// rateOf is the rate of the currency in a row of the history.
function rateOf(row: Rates, currency: CompanyCurrency): string {
  return { USD: row.usd, EUR: row.eur, RUB: row.rub }[currency.code] ?? "0.0000"
}

// CurrencyRates is the settings' tab of the rates (logic/currencies.md,
// section 4): what each currency the company has on is worth now, the way
// to enter new rates (settings.edit), and the history of the rows entered.
// A company in the so'm alone is told its admin turns the rest on.
export function CurrencyRates({ companyId, permissions }: { companyId: number; permissions: Permission[] }) {
  const currencies = useCurrencies()
  const others = currencies.filter((c) => c.id !== UZS)
  const multi = isMulti(currencies)
  const [page, setPage] = useState(1)
  const history = useRates(multi ? companyId : null, page)

  const columns: Column<Rates>[] = [
    { header: "Sana", primary: true, cell: (r) => formatDateTime(r.set_at) },
    ...others.map(
      (c) =>
        ({ header: c.code, align: "end", card: "inline", className: "tabular-nums", cell: (r) => formatRate(rateOf(r, c)) }) satisfies Column<Rates>,
    ),
    { header: "Kiritgan", className: "text-muted-foreground", cell: (r) => r.set_by_name },
  ]

  return (
    <>
      <Section
        title="Valyuta kurslari"
        description="Hujjatlar o'z sanasidagi kurs bilan so'mga aylantiriladi."
        action={multi && can(permissions, "settings.edit") && <RatesDialog companyId={companyId} currencies={others} />}
      >
        {multi ? (
          <ul aria-label="Joriy kurslar" className={settingList}>
            {others.map((c) => (
              <li key={c.id}>
                <SettingRow title={`${c.code} — ${c.name}`} detail={rateLine(c)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Kompaniyada boshqa valyuta yo'q"
            description="Valyutani admin yoqadi. Yoqilgach, kurslari shu yerda kiritiladi."
          />
        )}
      </Section>
      {multi && (
        <Section title="Tarix" description="Kiritilgan kurslar, yangisi birinchi. Har hujjat o'z sanasidagi kursni oladi.">
          {history.isPending && <ListLoading rows={2} mark="none" />}
          {history.isError && <Failed error={history.error} onRetry={() => history.refetch()} />}
          {history.data && history.data.total === 0 && <EmptyState title="Hali kurs kiritilmagan" />}
          {history.data && history.data.total > 0 && (
            <>
              <DataList label="Kurslar tarixi" items={history.data.items} columns={columns} getKey={(r) => r.id} />
              <Pager page={history.data.page} pageSize={history.data.page_size} total={history.data.total} onPage={setPage} />
            </>
          )}
        </Section>
      )}
    </>
  )
}
