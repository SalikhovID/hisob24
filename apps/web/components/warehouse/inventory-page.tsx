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
import { useInventory } from "@/lib/queries"
import type { InventoryItem, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { DeleteInventoryButton } from "./delete-inventory-button"

const back = { href: "/inventories", label: "Inventarizatsiya" }

// InventoryPage is one count of the member's locations (logic/warehouse.md,
// 5.2), for whoever may see the stock documents (changing and deleting
// each take their permission): its location (with two or more to work
// in), moment, note, who entered it and when; its lines, each product with
// what the journal expected, what was counted and the difference (a
// surplus green, a shortage red).
export function InventoryPage({ id }: { id: number }) {
  const gate = usePermission("stock.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const inventory = useInventory(companyId, id)
  const { locations } = useLocation()
  const router = useRouter()

  if (!gate) return null
  if (inventory.error instanceof ApiError && inventory.error.status === 404) {
    return <PageHeader title="Inventarizatsiya topilmadi" description="Bu inventarizatsiya o'chirilgan yoki siz ishlamaydigan lokatsiyada." back={back} />
  }
  if (!inventory.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Inventarizatsiya" back={back} />
        {inventory.isError ? <Failed error={inventory.error} onRetry={() => inventory.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const i = inventory.data
  const columns: Column<InventoryItem>[] = [
    { header: "Mahsulot", primary: true, cell: (item) => item.name },
    { header: "Tizim", card: "inline", className: "tabular-nums", cell: (item) => formatQuantity(item.expected, item.unit) },
    { header: "Sanalgan", card: "inline", className: "tabular-nums", cell: (item) => formatQuantity(item.counted, item.unit) },
    {
      header: "Farq",
      align: "end",
      card: "aside",
      className: "tabular-nums",
      cell: (item) => (
        <span className={cn(item.difference.startsWith("-") && "text-destructive", Number(item.difference) > 0 && "text-emerald-700 dark:text-emerald-400")}>
          {formatQuantity(item.difference, item.unit)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Inventarizatsiya № ${i.number}`}
        description={`${i.location_name} · ${formatDateTime(i.at)}`}
        back={back}
        stack
        actions={
          companyId !== null &&
          (allowed("stock.edit") || allowed("stock.delete")) && (
            <>
              {allowed("stock.edit") && (
                <Link href={`/inventories/${i.id}/edit`} className={buttonVariants({ size: "lg", className: "px-3.5" })}>
                  <PencilIcon />
                  Tahrirlash
                </Link>
              )}
              {allowed("stock.delete") && <DeleteInventoryButton companyId={companyId} inventory={i} afterDelete={() => router.replace("/inventories")} />}
            </>
          )
        }
      />
      <section aria-labelledby="inventory-info" className="space-y-3">
        <h2 id="inventory-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          {locations.length >= 2 && <Fact name="Lokatsiya" value={i.location_name} />}
          <Fact name="Vaqt" value={formatDateTime(i.at)} />
          <Fact name="Izoh" value={i.note} />
          <Fact name="Qo'shgan" value={i.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(i.created_at)} />
        </dl>
      </section>
      <section aria-labelledby="inventory-lines" className="space-y-3">
        <h2 id="inventory-lines" className="text-base font-semibold">
          Qatorlar
        </h2>
        <DataList label="Qatorlar" items={i.items} columns={columns} getKey={(item) => item.product_id} href={(item) => `/products/${item.product_id}`} />
      </section>
    </div>
  )
}
