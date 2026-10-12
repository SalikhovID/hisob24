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
import { useSale } from "@/lib/queries"
import type { LinkedPayment, Permission, PurchaseItem } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeleteSaleButton } from "./delete-sale-button"

const back = { href: "/sales", label: "Sotuvlar" }

// SalePage is one sale in the member's locations (logic/sales.md, 3.4), for
// whoever may see the sales (changing and deleting each take their
// permission): its customer (the way to them, for whoever may see the
// customers; retail otherwise), moment and location (with two or more to
// work in), its currency and rate (with another than the so'm), what it
// came to (in so'm too) and what was paid with it, its note, who entered
// it and when; its lines and the payments entered with it.
export function SalePage({ id }: { id: number }) {
  const gate = usePermission("sales.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const sale = useSale(companyId, id)
  const { locations } = useLocation()
  const currencies = useCurrencies()
  const router = useRouter()

  if (!gate) return null
  if (sale.error instanceof ApiError && sale.error.status === 404) {
    return <PageHeader title="Sotuv topilmadi" description="Bu sotuv o'chirilgan yoki siz ishlamaydigan lokatsiyada." back={back} />
  }
  if (!sale.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Sotuv" back={back} />
        {sale.isError ? <Failed error={sale.error} onRetry={() => sale.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const s = sale.data
  const currency = currencyOf(currencies, s.currency_id)
  const customer = s.customer?.name ?? "Chakana"
  const columns: Column<PurchaseItem>[] = [
    { header: "Mahsulot", primary: true, cell: (item) => item.name },
    { header: "Miqdor", card: "inline", className: "tabular-nums", cell: (item) => formatQuantity(item.quantity, item.unit) },
    { header: `Narx, ${currency.symbol}`, align: "end", card: "inline", cell: (item) => formatAmount(item.price) },
    { header: `Summa, ${currency.symbol}`, align: "end", card: "aside", cell: (item) => formatAmount(item.amount) },
  ]
  const paymentColumns: Column<LinkedPayment>[] = [
    { header: "Akkaunt", primary: true, cell: (payment) => payment.account_name },
    { header: "Summa", align: "end", card: "aside", cell: (payment) => formatMoney(payment.amount, currencyOf(currencies, payment.currency_id)) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Sotuv № ${s.number}`}
        description={`${customer} · ${formatDateTime(s.at)}`}
        back={back}
        stack
        actions={
          companyId !== null &&
          (allowed("sales.edit") || allowed("sales.delete")) && (
            <>
              {allowed("sales.edit") && (
                <Link href={`/sales/${s.id}/edit`} className={buttonVariants({ size: "lg", className: "px-3.5" })}>
                  <PencilIcon />
                  Tahrirlash
                </Link>
              )}
              {allowed("sales.delete") && <DeleteSaleButton companyId={companyId} sale={s} afterDelete={() => router.replace("/sales")} />}
            </>
          )
        }
      />
      <section aria-labelledby="sale-info" className="space-y-3">
        <h2 id="sale-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          <Fact
            name="Mijoz"
            value={
              s.customer && allowed("customers.view") ? (
                <Link href={`/customers/${s.customer.id}`} className="font-medium underline-offset-4 hover:underline">
                  {s.customer.name}
                </Link>
              ) : (
                customer
              )
            }
          />
          <Fact name="Vaqt" value={formatDateTime(s.at)} />
          {locations.length >= 2 && <Fact name="Lokatsiya" value={s.location_name} />}
          {s.currency_id !== UZS && <Fact name="Valyuta" value={`${currency.code} · ${rateLine({ ...currency, rate: s.rate })}`} />}
          <Fact name="Jami" value={formatMoney(s.total, currency)} />
          {s.currency_id !== UZS && <Fact name="So'mda" value={formatMoney(s.total_uzs, som)} />}
          <Fact name="To'langan" value={formatMoney(s.paid, currency)} />
          <Fact name="Izoh" value={s.note} />
          <Fact name="Qo'shgan" value={s.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(s.created_at)} />
        </dl>
      </section>
      <section aria-labelledby="sale-lines" className="space-y-3">
        <h2 id="sale-lines" className="text-base font-semibold">
          Qatorlar
        </h2>
        <DataList
          label="Qatorlar"
          items={s.items}
          columns={columns}
          getKey={(item) => item.product_id}
          href={(item) => `/products/${item.product_id}`}
          footer={<span className="tabular-nums">Jami: {formatAmount(s.total)}</span>}
        />
      </section>
      {s.payments.length > 0 && (
        <section aria-labelledby="sale-payments" className="space-y-3">
          <h2 id="sale-payments" className="text-base font-semibold">
            To&apos;lovlar
          </h2>
          <DataList label="To'lovlar" items={s.payments} columns={paymentColumns} getKey={(payment) => payment.id} />
        </section>
      )}
    </div>
  )
}
