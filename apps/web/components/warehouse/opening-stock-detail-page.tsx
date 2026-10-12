"use client"

import { PencilIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type Column, DataList } from "@/components/data-list"
import { Fact } from "@/components/facts"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { currencyOf, rateLine, som, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatDate, formatDateTime, formatMoney, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useOpeningStock } from "@/lib/queries"
import type { Permission, PurchaseItem } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeleteOpeningStockButton } from "./delete-opening-stock-button"

const back = { href: "/opening-stock", label: "Boshlang'ich qoldiq" }

// OpeningStockDetailPage is one opening stock of the member's locations
// (logic/warehouse.md, 5.3), for whoever may see the stock documents
// (changing and deleting each take their permission): its location (with
// two or more to work in), moment, currency and rate (with another than
// the so'm), what it came to (in so'm too), its note, who entered it and
// when; its lines, each product with its quantity, price and what the line
// came to.
export function OpeningStockDetailPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const opening = useOpeningStock(companyId, id)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const router = useRouter()

  if (!gate) return null
  if (opening.error instanceof ApiError && opening.error.status === 404) {
    return <PageHeader title="Hujjat topilmadi" description="Bu hujjat o'chirilgan yoki siz ishlamaydigan lokatsiyada." back={back} />
  }
  if (!opening.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Boshlang'ich qoldiq" back={back} />
        {opening.isError ? <Failed error={opening.error} onRetry={() => opening.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const o = opening.data
  const currency = currencyOf(currencies, o.currency_id)
  const columns: Column<PurchaseItem>[] = [
    { header: "Mahsulot", primary: true, cell: (item) => item.name },
    { header: "Miqdor", card: "inline", className: "tabular-nums", cell: (item) => formatQuantity(item.quantity, item.unit) },
    { header: `Narx, ${currency.symbol}`, align: "end", card: "inline", cell: (item) => formatAmount(item.price) },
    { header: `Summa, ${currency.symbol}`, align: "end", card: "aside", cell: (item) => formatAmount(item.amount) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Boshlang'ich qoldiq № ${o.number}`}
        description={`${o.location_name} · ${formatDateTime(o.at)}`}
        back={back}
        stack
        actions={
          companyId !== null &&
          (allowed("stock.edit") || allowed("stock.delete")) && (
            <>
              {allowed("stock.edit") && (
                <Link href={`/opening-stock/${o.id}/edit`} className={buttonVariants({ size: "lg", className: "px-3.5" })}>
                  <PencilIcon />
                  Tahrirlash
                </Link>
              )}
              {allowed("stock.delete") && <DeleteOpeningStockButton companyId={companyId} opening={o} afterDelete={() => router.replace("/opening-stock")} />}
            </>
          )
        }
      />
      <section aria-labelledby="opening-info" className="space-y-3">
        <h2 id="opening-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          {locations.length >= 2 && <Fact name="Lokatsiya" value={o.location_name} />}
          <Fact name="Vaqt" value={formatDateTime(o.at)} />
          {o.currency_id !== UZS && <Fact name="Valyuta" value={`${currency.code} · ${rateLine({ ...currency, rate: o.rate })}`} />}
          <Fact name="Jami" value={formatMoney(o.total, currency)} />
          {o.currency_id !== UZS && <Fact name="So'mda" value={formatMoney(o.total_uzs, som)} />}
          <Fact name="Izoh" value={o.note} />
          <Fact name="Qo'shgan" value={o.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(o.created_at)} />
        </dl>
      </section>
      <section aria-labelledby="opening-lines" className="space-y-3">
        <h2 id="opening-lines" className="text-base font-semibold">
          Qatorlar
        </h2>
        <DataList
          label="Qatorlar"
          items={o.items}
          columns={columns}
          getKey={(item) => item.product_id}
          href={(item) => `/products/${item.product_id}`}
          footer={<span className="tabular-nums">Jami: {formatAmount(o.total)}</span>}
        />
      </section>
    </div>
  )
}
