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
import { balanceText } from "@/lib/warehouse"
import { cn } from "@/lib/utils"
import { DeleteSupplierButton } from "./delete-supplier-button"
import { SupplierActiveButton } from "./supplier-active-button"
import { SupplierDialog } from "./supplier-dialog"
import { SupplierPayments } from "./supplier-payments"
import { SupplierPurchases } from "./supplier-purchases"

const back = { href: "/suppliers", label: "Ta'minotchilar" }

// SupplierPage is one supplier of the company (logic/warehouse.md, 3.3), for
// whoever may see the suppliers (changing, turning off and deleting each
// take their permission): its phone and note, who entered it and when;
// and, for whoever may see the purchases, what it is owed, its purchases
// and the payments to it.
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
  const balance = s.balance === null ? null : balanceText(s.balance)

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
      {seesBalance && balance && (
        // What is owed: the live purchases less the live payments, the
        // whole company's (logic/warehouse.md, section 6).
        <section aria-label="Balans" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
          <p
            className={cn(
              "text-lg font-semibold tabular-nums",
              balance.kind === "debt" && "text-destructive",
              balance.kind === "advance" && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {balance.text}
          </p>
          <p className="text-sm">
            <span className="block text-[0.8125rem] leading-5 text-muted-foreground">Jami xaridlar</span>
            <span className="tabular-nums">{formatAmount(s.purchases_total ?? "0")} so&apos;m</span>
          </p>
          <p className="text-sm">
            <span className="block text-[0.8125rem] leading-5 text-muted-foreground">Jami to&apos;lovlar</span>
            <span className="tabular-nums">{formatAmount(s.payments_total ?? "0")} so&apos;m</span>
          </p>
        </section>
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
        <>
          <SupplierPurchases companyId={companyId} supplierId={s.id} />
          <SupplierPayments
            companyId={companyId}
            supplierId={s.id}
            canAdd={allowed("purchases.create")}
            canEdit={allowed("purchases.edit")}
            canDelete={allowed("purchases.delete")}
          />
        </>
      )}
    </div>
  )
}
