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
import { formatAmount, formatDate, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { usePurchase } from "@/lib/queries"
import type { Permission, PurchaseItem } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeletePurchaseButton } from "./delete-purchase-button"

const back = { href: "/purchases", label: "Xaridlar" }

// PurchasePage is one purchase in the member's locations (logic/warehouse.md,
// 4.5), for whoever may see the purchases (changing and deleting each take
// their permission): its supplier, day and location (with two or more to
// work in), what it came to and what was paid with it, its note, who
// entered it and when; and its lines, each product with its quantity, price
// and what the line came to.
export function PurchasePage({ id }: { id: number }) {
  const gate = usePermission("purchases.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const purchase = usePurchase(companyId, id)
  const { locations } = useLocation()
  const router = useRouter()

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  // A purchase that is gone, or stands in a location the member does not
  // work in, is not found: there is nothing to try again.
  if (purchase.error instanceof ApiError && purchase.error.status === 404) {
    return <PageHeader title="Xarid topilmadi" description="Bu xarid o'chirilgan yoki siz ishlamaydigan lokatsiyada." back={back} />
  }
  if (!purchase.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Xarid" back={back} />
        {purchase.isError ? <Failed error={purchase.error} onRetry={() => purchase.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const p = purchase.data
  const columns: Column<PurchaseItem>[] = [
    { header: "Mahsulot", primary: true, cell: (item) => item.name },
    { header: "Miqdor", card: "inline", className: "tabular-nums", cell: (item) => formatQuantity(item.quantity, item.unit) },
    { header: "Narx, so'm", align: "end", card: "inline", cell: (item) => formatAmount(item.price) },
    { header: "Summa, so'm", align: "end", card: "aside", cell: (item) => formatAmount(item.amount) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Xarid № ${p.number}`}
        description={`${p.supplier.name} · ${formatDate(p.purchased_on)}`}
        back={back}
        stack
        actions={
          companyId !== null &&
          (allowed("purchases.edit") || allowed("purchases.delete")) && (
            <>
              {allowed("purchases.edit") && (
                <Link href={`/purchases/${p.id}/edit`} className={buttonVariants({ size: "lg", className: "px-3.5" })}>
                  <PencilIcon />
                  Tahrirlash
                </Link>
              )}
              {allowed("purchases.delete") && <DeletePurchaseButton companyId={companyId} purchase={p} afterDelete={() => router.replace("/purchases")} />}
            </>
          )
        }
      />
      <section aria-labelledby="purchase-info" className="space-y-3">
        <h2 id="purchase-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          <Fact
            name="Ta'minotchi"
            value={
              allowed("suppliers.view") ? (
                <Link href={`/suppliers/${p.supplier.id}`} className="font-medium underline-offset-4 hover:underline">
                  {p.supplier.name}
                </Link>
              ) : (
                p.supplier.name
              )
            }
          />
          <Fact name="Sana" value={formatDate(p.purchased_on)} />
          {locations.length >= 2 && <Fact name="Lokatsiya" value={p.location_name} />}
          <Fact name="Jami" value={`${formatAmount(p.total)} so'm`} />
          <Fact name="To'langan" value={`${formatAmount(p.paid)} so'm`} />
          <Fact name="Izoh" value={p.note} />
          <Fact name="Qo'shgan" value={p.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(p.created_at)} />
        </dl>
      </section>
      <section aria-labelledby="purchase-lines" className="space-y-3">
        <h2 id="purchase-lines" className="text-base font-semibold">
          Qatorlar
        </h2>
        <DataList
          label="Qatorlar"
          items={p.items}
          columns={columns}
          getKey={(item) => item.product_id}
          href={(item) => `/products/${item.product_id}`}
          footer={<span className="tabular-nums">Jami: {formatAmount(p.total)}</span>}
        />
      </section>
    </div>
  )
}
