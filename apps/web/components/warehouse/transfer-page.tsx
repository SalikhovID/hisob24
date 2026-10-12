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
import { formatDate, formatDateTime, formatQuantity } from "@/lib/format"
import { can } from "@/lib/permissions"
import { useTransfer } from "@/lib/queries"
import type { Permission, TransferItem } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { DeleteTransferButton } from "./delete-transfer-button"

const back = { href: "/transfers", label: "Ko'chirishlar" }

// TransferPage is one transfer out of or into the member's locations
// (logic/warehouse.md, 5.1), for whoever may see the stock documents: where
// it comes from and goes to, its moment, note, who entered it and when; its
// lines, each product with its quantity. Changing and deleting take their
// permission and the source among the member's locations.
export function TransferPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const transfer = useTransfer(companyId, id)
  const { locations } = useLocation()
  const router = useRouter()

  if (!gate) return null
  if (transfer.error instanceof ApiError && transfer.error.status === 404) {
    return <PageHeader title="Ko'chirish topilmadi" description="Bu ko'chirish o'chirilgan yoki siz ishlamaydigan lokatsiyalar orasida." back={back} />
  }
  if (!transfer.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Ko'chirish" back={back} />
        {transfer.isError ? <Failed error={transfer.error} onRetry={() => transfer.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const t = transfer.data
  // A transfer seen from its destination alone is not the member's to change.
  const mine = locations.some((l) => l.id === t.location_id)
  const columns: Column<TransferItem>[] = [
    { header: "Mahsulot", primary: true, cell: (item) => item.name },
    { header: "Miqdor", align: "end", card: "aside", className: "tabular-nums", cell: (item) => formatQuantity(item.quantity, item.unit) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Ko'chirish № ${t.number}`}
        description={`${t.location_name} → ${t.to_location_name} · ${formatDateTime(t.at)}`}
        back={back}
        stack
        actions={
          companyId !== null &&
          mine &&
          (allowed("stock.edit") || allowed("stock.delete")) && (
            <>
              {allowed("stock.edit") && (
                <Link href={`/transfers/${t.id}/edit`} className={buttonVariants({ size: "lg", className: "px-3.5" })}>
                  <PencilIcon />
                  Tahrirlash
                </Link>
              )}
              {allowed("stock.delete") && <DeleteTransferButton companyId={companyId} transfer={t} afterDelete={() => router.replace("/transfers")} />}
            </>
          )
        }
      />
      <section aria-labelledby="transfer-info" className="space-y-3">
        <h2 id="transfer-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          <Fact name="Qayerdan" value={t.location_name} />
          <Fact name="Qayerga" value={t.to_location_name} />
          <Fact name="Vaqt" value={formatDateTime(t.at)} />
          <Fact name="Izoh" value={t.note} />
          <Fact name="Qo'shgan" value={t.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(t.created_at)} />
        </dl>
      </section>
      <section aria-labelledby="transfer-lines" className="space-y-3">
        <h2 id="transfer-lines" className="text-base font-semibold">
          Qatorlar
        </h2>
        <DataList label="Qatorlar" items={t.items} columns={columns} getKey={(item) => item.product_id} href={(item) => `/products/${item.product_id}`} />
      </section>
    </div>
  )
}
