"use client"

import { BanknoteIcon, PackagePlusIcon, PencilIcon, PhoneIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Group, KeyValue, SectionHeading } from "@/components/kit/group"
import { PageAction, PageActions } from "@/components/kit/page-actions"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { StatCard, StatCards } from "@/components/kit/stat-cards"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { ApiError } from "@/lib/api"
import { formatAmount, formatDate } from "@/lib/format"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useSupplier } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { BalanceStat } from "./balance-card"
import { DeleteSupplierButton } from "./delete-supplier-button"
import { PaymentDialog } from "./payment-dialog"
import { StatementList } from "./statement-list"
import { SupplierActiveButton } from "./supplier-active-button"
import { SupplierDialog } from "./supplier-dialog"
import { moving } from "@/lib/moves"

const back = { href: "/suppliers", label: "Ta'minotchilar" }

// SupplierPage is one supplier of the company (logic/warehouse.md, 3.3), for
// whoever may see the suppliers (changing, turning off and deleting each
// take their permission), as the prototype's page: its name over its phone
// (and «Nofaol» when off), the actions at the title's right (a payment, a
// purchase from it, a call, an edit); for whoever may see the purchases
// what it is owed, the prototype's cards (the balance in so'm, in each
// currency apart; the purchases' and the payments' totals beside it);
// its statement; its facts; and at the foot the rows that turn it off and
// delete it.
export function SupplierPage({ id }: { id: number }) {
  const gate = usePermission("suppliers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const supplier = useSupplier(companyId, id)
  const router = useRouter()
  const location = useLocation()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  // A supplier that is gone, or is another company's, is not found: there
  // is nothing to try again.
  if (supplier.error instanceof ApiError && supplier.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Ta'minotchi topilmadi" description="Bu ta'minotchi o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  if (!supplier.data || companyId === null) {
    return (
      <>
        <PageTitle title="Ta'minotchi" back={back} />
        {supplier.isError ? <Failed error={supplier.error} onRetry={() => supplier.refetch()} /> : <ListLoading rows={4} mark="none" />}
      </>
    )
  }
  const s = supplier.data
  const phone = s.phone ? formatPhone(s.phone) : null
  const seesBalance = allowed("purchases.view") && s.balance !== null
  // A purchase from the supplier is entered into the current location, by
  // whoever may add purchases and find the products; not from an inactive one.
  const canBuy = s.is_active && allowed("purchases.create") && allowed("products.view") && location.current !== null
  const actions = [
    allowed("purchases.create") && <PageAction key="pay" icon={BanknoteIcon} label="To'lov" onClick={() => setPaying(true)} />,
    canBuy && <PageAction key="buy" icon={PackagePlusIcon} label="Xarid" href={`/purchases/new?supplier=${s.id}`} />,
    s.phone && <PageAction key="call" icon={PhoneIcon} label="Qo'ng'iroq" href={`tel:+${s.phone}`} />,
    allowed("suppliers.edit") && <PageAction key="edit" icon={PencilIcon} label="Tahrirlash" onClick={() => setEditing(true)} />,
  ].filter(Boolean)

  return (
    <>
      <PageTitle
        back={back}
        title={s.name}
        description={
          <>
            <span>{phone ?? "Telefon yo'q"}</span>
            {!s.is_active && <Badge className="ml-2 align-middle">Nofaol</Badge>}
          </>
        }
        action={actions.length > 0 && <PageActions>{actions}</PageActions>}
      />
      {seesBalance && (
        // What is owed: the live purchases less the live payments, the
        // whole company's (logic/warehouse.md, section 6).
        <section aria-label="Balans">
          <StatCards three>
            <BalanceStat balance={s.balance!} byCurrency={s.balance_by_currency ?? null} />
            <StatCard label="Jami xaridlar" value={`${formatAmount(s.purchases_total ?? "0")} so'm`} />
            <StatCard label="Jami to'lovlar" value={`${formatAmount(s.payments_total ?? "0")} so'm`} />
          </StatCards>
        </section>
      )}
      {allowed("purchases.view") && (
        <StatementList
          party="supplier"
          companyId={companyId}
          partyId={s.id}
          canAdd={allowed("purchases.create")}
          canEdit={allowed("purchases.edit")}
          canDelete={allowed("purchases.delete")}
        />
      )}
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          <KeyValue label="Telefon" value={phone} />
          <KeyValue label="Izoh" value={s.note} />
          <KeyValue label="Qo'shgan" value={s.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(s.created_at)} />
        </Group>
      </section>
      {(allowed("suppliers.edit") || allowed("suppliers.delete")) && (
        <Group>
          {allowed("suppliers.edit") && <SupplierActiveButton companyId={companyId} supplier={s} />}
          {allowed("suppliers.delete") && <DeleteSupplierButton companyId={companyId} supplier={s} afterDelete={() => moving("back", () => router.replace("/suppliers"))} />}
        </Group>
      )}
      {editing && <SupplierDialog companyId={companyId} supplier={s} open onOpenChange={(open) => !open && setEditing(false)} />}
      {paying && (
        <PaymentDialog companyId={companyId} partyId={s.id} partyName={s.name} owed={s.balance} open onOpenChange={(open) => !open && setPaying(false)} />
      )}
    </>
  )
}
