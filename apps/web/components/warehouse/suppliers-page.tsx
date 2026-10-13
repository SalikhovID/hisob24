"use client"

import { SearchIcon, TruckIcon } from "lucide-react"
import { useState } from "react"
import { useCatalogFilter } from "@/components/catalog/use-catalog-filter"
import { Avatar } from "@/components/kit/avatar"
import { ChoiceChips } from "@/components/kit/chips"
import { Foot, Group, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SearchBox } from "@/components/kit/search-box"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useSuppliers } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { cn } from "@/lib/utils"
import { balanceText } from "@/lib/warehouse"
import { SupplierDialog } from "./supplier-dialog"

// Balance is what a supplier is owed, at the end of its row: red when
// something is owed, green when paid in advance, nothing when even. Shown
// to whoever may see the purchases alone.
function Balance({ balance }: { balance: string | null }) {
  if (balance === null) return null
  const { kind, text } = balanceText(balance)
  if (kind === "none") return null
  return <span className={cn("text-md", kind === "debt" ? "text-destructive" : "text-positive")}>{text}</span>
}

// SuppliersPage is the company's suppliers, for whoever may see them
// (suppliers.view; adding, editing and deleting each take their
// permission), as the prototype's list: by name, the active ones unless
// the «Nofaol» chip is on (each chip says how many), searched by name (or,
// as digits, by phone); a row each, its phone under its name and, for
// whoever may see the purchases, what it is owed at its end. A supplier
// has a page.
export function SuppliersPage() {
  const gate = usePermission("suppliers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const [filter, update] = useCatalogFilter()
  const suppliers = useSuppliers(companyId, filter)
  const [adding, setAdding] = useState(false)
  // The chips' counts: every active supplier and every inactive one,
  // whatever is searched. The active one is the list itself when nothing is.
  const active = useSuppliers(companyId, { status: "active", search: "", page: 1 })
  const inactive = useSuppliers(companyId, { status: "inactive", search: "", page: 1 })
  const activeCount = active.data && !active.isPlaceholderData ? active.data.total : undefined
  const inactiveCount = inactive.data && !inactive.isPlaceholderData ? inactive.data.total : undefined

  const unfiltered = filter.status === "active" && !filter.search
  // A list of the previous filter may stay on screen while the next loads;
  // "nothing found" may not.
  const settling = suppliers.isPlaceholderData && suppliers.data?.total === 0
  const loading = suppliers.isPending || settling
  const owed = allowed("purchases.view")

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  const page = suppliers.data
  return (
    <>
      <PageTitle
        back={{ href: "/warehouse", label: "Ombor" }}
        title="Ta'minotchilar"
        description={activeCount !== undefined ? `Kompaniyangiz ta'minotchilari · ${activeCount} ta` : "Kompaniyangiz ta'minotchilari"}
        action={companyId !== null && allowed("suppliers.create") && <PlusButton label="Ta'minotchi qo'shish" onClick={() => setAdding(true)} />}
      />
      <SearchBox value={filter.search} onSearch={(search) => update({ search })} placeholder="Nom yoki telefon" />
      <ChoiceChips
        label="Holat"
        value={filter.status}
        onChange={(status) => update({ status: status === "inactive" ? "inactive" : "active" })}
        options={[
          { value: "active", label: "Faol", count: activeCount },
          { value: "inactive", label: "Nofaol", count: inactiveCount },
        ]}
      />
      {loading && <ListLoading rows={6} />}
      {suppliers.isError && <Failed error={suppliers.error} onRetry={() => suppliers.refetch()} />}
      {!loading && !suppliers.isError && page?.total === 0 && (
        <EmptyState
          icon={filter.search ? SearchIcon : TruckIcon}
          title={unfiltered ? "Hali ta'minotchi yo'q" : filter.search ? "Ta'minotchilar topilmadi" : "Nofaol ta'minotchi yo'q"}
          description={
            unfiltered
              ? "Birinchi ta'minotchini «Ta'minotchi qo'shish» tugmasi orqali qo'shing."
              : filter.search
                ? "Qidiruv yoki filtrni o'zgartirib ko'ring."
                : undefined
          }
        />
      )}
      {!loading && !suppliers.isError && page && page.total > 0 && (
        <>
          <Group label="Ta'minotchilar" inset="icon" className={cn(suppliers.isPlaceholderData && "opacity-60")}>
            {page.items.map((supplier) => (
              <Row
                key={supplier.id}
                href={`/suppliers/${supplier.id}`}
                media={<Avatar name={supplier.name} seed={supplier.id} square />}
                title={supplier.name}
                sub={supplier.phone ? formatPhone(supplier.phone) : "Telefon yo'q"}
                end={owed ? <Balance balance={supplier.balance} /> : undefined}
                chevron={false}
              />
            ))}
          </Group>
          {page.total > page.page_size ? (
            <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
          ) : (
            <Foot>Jami: {page.total}</Foot>
          )}
        </>
      )}
      {adding && companyId !== null && <SupplierDialog companyId={companyId} open onOpenChange={(open) => !open && setAdding(false)} />}
    </>
  )
}
