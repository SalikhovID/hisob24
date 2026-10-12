"use client"

import { useRouter } from "next/navigation"
import { Fact } from "@/components/facts"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { ApiError } from "@/lib/api"
import { formatAmount, formatDate } from "@/lib/format"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useSupplier } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { DeleteSupplierButton } from "./delete-supplier-button"
import { SupplierActiveButton } from "./supplier-active-button"
import { BalanceCard } from "./balance-card"
import { StatementList } from "./statement-list"
import { SupplierDialog } from "./supplier-dialog"

const back = { href: "/suppliers", label: "Ta'minotchilar" }

// SupplierPage is one supplier of the company (logic/warehouse.md, 3.3), for
// whoever may see the suppliers (changing, turning off and deleting each
// take their permission): its phone and note, who entered it and when;
// and, for whoever may see the purchases, what it is owed (in so'm, and in
// each currency apart) and its statement.
export function SupplierPage({ id }: { id: number }) {
  const gate = usePermission("suppliers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const supplier = useSupplier(companyId, id)
  const router = useRouter()

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  // A supplier that is gone, or is another company's, is not found: there
  // is nothing to try again.
  if (supplier.error instanceof ApiError && supplier.error.status === 404) {
    return <PageHeader title="Ta'minotchi topilmadi" description="Bu ta'minotchi o'chirilgan yoki sizning kompaniyangizniki emas." back={back} />
  }
  if (!supplier.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Ta'minotchi" back={back} />
        {supplier.isError ? <Failed error={supplier.error} onRetry={() => supplier.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </div>
    )
  }
  const s = supplier.data
  const phone = s.phone ? formatPhone(s.phone) : null
  const seesBalance = allowed("purchases.view") && s.balance !== null

  return (
    <div className="space-y-5">
      <PageHeader
        title={s.name}
        description={
          <>
            {phone}
            {!s.is_active && (
              <>
                {phone && " "}
                <Badge variant="outline">Nofaol</Badge>
              </>
            )}
          </>
        }
        back={back}
        stack
        actions={
          companyId !== null &&
          (allowed("suppliers.edit") || allowed("suppliers.delete")) && (
            <>
              {allowed("suppliers.edit") && <SupplierDialog companyId={companyId} supplier={s} />}
              {allowed("suppliers.edit") && <SupplierActiveButton companyId={companyId} supplier={s} />}
              {allowed("suppliers.delete") && <DeleteSupplierButton companyId={companyId} supplier={s} afterDelete={() => router.replace("/suppliers")} />}
            </>
          )
        }
      />
      {seesBalance && (
        // What is owed: the live purchases less the live payments, the
        // whole company's (logic/warehouse.md, section 6).
        <BalanceCard balance={s.balance!} byCurrency={s.balance_by_currency ?? null}>
          <p className="text-sm">
            <span className="block text-[0.8125rem] leading-5 text-muted-foreground">Jami xaridlar</span>
            <span className="tabular-nums">{formatAmount(s.purchases_total ?? "0")} so&apos;m</span>
          </p>
          <p className="text-sm">
            <span className="block text-[0.8125rem] leading-5 text-muted-foreground">Jami to&apos;lovlar</span>
            <span className="tabular-nums">{formatAmount(s.payments_total ?? "0")} so&apos;m</span>
          </p>
        </BalanceCard>
      )}
      <section aria-labelledby="supplier-info" className="space-y-3">
        <h2 id="supplier-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          <Fact name="Telefon" value={phone} />
          <Fact name="Izoh" value={s.note} />
          <Fact name="Qo'shgan" value={s.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(s.created_at)} />
        </dl>
      </section>
      {companyId !== null && allowed("purchases.view") && (
        <StatementList
          party="supplier"
          companyId={companyId}
          partyId={s.id}
          canAdd={allowed("purchases.create")}
          canEdit={allowed("purchases.edit")}
          canDelete={allowed("purchases.delete")}
        />
      )}
    </div>
  )
}
