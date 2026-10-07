"use client"

import { useState } from "react"
import { useCatalogFilter } from "@/components/catalog/use-catalog-filter"
import { SearchInput } from "@/components/customers/search-input"
import { type Column, DataList } from "@/components/data-list"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { SectionTabs } from "@/components/section-tabs"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatAmount, formatDate } from "@/lib/format"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useSuppliers } from "@/lib/queries"
import type { Permission, Supplier } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { SupplierDialog } from "./supplier-dialog"

// A tab is quiet until it is the chosen one, which then stands out as a card
// on the muted strip. Never the brand color: that is the page's one button.
const tab = "px-3 text-muted-foreground data-active:bg-card"

const warehouseSection = navItems.find((item) => item.key === "warehouse")!

// Balance is what a supplier is owed in the list: red when something is
// owed, green when paid in advance, nothing when even. Shown to whoever may
// see the purchases alone.
export function Balance({ balance }: { balance: string | null }) {
  if (balance === null) return null
  const value = Number(balance)
  if (value > 0) return <span className="font-medium text-destructive">{formatAmount(balance)}</span>
  if (value < 0) return <span className="font-medium text-emerald-700 dark:text-emerald-400">Avans {formatAmount(balance.replace("-", ""))}</span>
  return null
}

// SuppliersPage is the company's suppliers, for whoever may see them
// (suppliers.view; adding, editing and deleting each take their
// permission): by name, the active ones unless the «Nofaol» tab is open,
// searched by name (or, as digits, by phone), each with what it is owed
// for whoever may see the purchases. A supplier has a page.
export function SuppliersPage() {
  const gate = usePermission("suppliers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useCatalogFilter()
  const suppliers = useSuppliers(companyId, filter)

  const columns: Column<Supplier>[] = [
    { header: "Ta'minotchi", primary: true, cell: (s) => s.name },
    { header: "Telefon", card: "inline", className: "text-muted-foreground tabular-nums", cell: (s) => s.phone && formatPhone(s.phone) },
    ...(allowed("purchases.view")
      ? [{ header: "Qarz", align: "end", card: "aside", cell: (s) => <Balance balance={s.balance} /> } satisfies Column<Supplier>]
      : []),
    { header: "Qo'shgan", className: "text-muted-foreground", cell: (s) => s.created_by_name },
    { header: "Qo'shilgan", card: "inline", className: "text-muted-foreground", cell: (s) => formatDate(s.created_at) },
  ]

  // How many suppliers the company has is the unfiltered list's total: under
  // the «Nofaol» tab or a search the API counts the matches only.
  const unfiltered = filter.status === "active" && !filter.search
  const [total, setTotal] = useState<number>()
  if (unfiltered && suppliers.data && !suppliers.isPlaceholderData && suppliers.data.total !== total) {
    setTotal(suppliers.data.total)
  }
  // A list of the previous filter may stay on screen while the next loads;
  // "nothing found" may not.
  const settling = suppliers.isPlaceholderData && suppliers.data?.total === 0
  const loading = suppliers.isPending || settling

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  return (
    <div className="space-y-5">
      <SectionTabs item={warehouseSection} permissions={gate.permissions} />
      <PageHeader
        title="Ta'minotchilar"
        description={unfiltered && total !== undefined ? `Kompaniyangiz ta'minotchilari · ${total} ta` : "Kompaniyangiz ta'minotchilari"}
        actions={companyId !== null && allowed("suppliers.create") && <SupplierDialog companyId={companyId} />}
      />
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter.status} onValueChange={(value) => update({ status: value === "inactive" ? "inactive" : "active" })}>
            <TabsList aria-label="Holat" className="group-data-horizontal/tabs:h-9">
              <TabsTrigger value="active" className={tab}>
                Faol
              </TabsTrigger>
              <TabsTrigger value="inactive" className={tab}>
                Nofaol
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput value={filter.search} onSearch={(search) => update({ search })} placeholder="Nom yoki telefon" />
        </div>
        {loading && <ListLoading rows={6} mark="none" />}
        {suppliers.isError && <Failed error={suppliers.error} onRetry={() => suppliers.refetch()} />}
        {!loading && !suppliers.isError && suppliers.data?.total === 0 && (
          <EmptyState
            title={unfiltered ? "Hali ta'minotchi yo'q" : "Ta'minotchilar topilmadi"}
            description={unfiltered ? "Birinchi ta'minotchini «Ta'minotchi qo'shish» tugmasi orqali qo'shing." : "Qidiruv yoki filtrni o'zgartirib ko'ring."}
          />
        )}
        {!loading && !suppliers.isError && suppliers.data && suppliers.data.total > 0 && (
          <DataList
            label="Ta'minotchilar"
            items={suppliers.data.items}
            columns={columns}
            getKey={(s) => s.id}
            href={(s) => `/suppliers/${s.id}`}
            footer={
              <Pager page={suppliers.data.page} pageSize={suppliers.data.page_size} total={suppliers.data.total} onPage={(page) => update({ page })} />
            }
          />
        )}
      </div>
    </div>
  )
}
