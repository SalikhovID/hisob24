"use client"

import { BanknoteIcon, ClipboardPlusIcon, PencilIcon, PhoneIcon } from "lucide-react"
import { useState } from "react"
import { PageAction, PageActions } from "@/components/kit/page-actions"
import { Group, KeyValue } from "@/components/kit/group"
import { InPageTabs } from "@/components/kit/in-page-tabs"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { NewOrder } from "@/components/orders/new-order"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { answerText } from "@/lib/fields"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { can } from "@/lib/permissions"
import { useCustomer, useCustomerDropdowns, useCustomerTypes, useOrders, useSales } from "@/lib/queries"
import type { BalanceLine, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { BalanceStat } from "@/components/warehouse/balance-card"
import { StatCard, StatCards } from "@/components/kit/stat-cards"
import { PaymentDialog } from "@/components/warehouse/payment-dialog"
import { StatementList } from "@/components/warehouse/statement-list"
import { CustomerHistory } from "./customer-history"
import { CustomerOrders } from "./customer-orders"
import { DeleteCustomerButton } from "./delete-customer-button"
import { EditCustomerDialog } from "./edit-customer-dialog"

const back = { href: "/customers", label: "Mijozlar" }

// CustomerPage is one customer of the company, for whoever may see the
// customers (changing, deleting, the history and the orders each take their
// permission), as the prototype's page: who it is (its avatar, its name,
// its type and phone), the tiles (editing, an order for it, a call to its
// phone), its answer
// to every field of its type in the type's order with who entered it and
// when; for whoever may see the sales, what they owe and their statement
// (logic/sales.md, section 5); its orders, its history, and at the foot the
// way to delete it.
export function CustomerPage({ id }: { id: number }) {
  const gate = usePermission("customers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const customer = useCustomer(companyId, id)
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const [editing, setEditing] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [paying, setPaying] = useState(false)
  // An order for the customer goes into the current location.
  const locationId = useLocation().current?.id ?? null

  // A customer that is gone, or is another company's, is not found: there
  // is nothing to try again.
  if (customer.error instanceof ApiError && customer.error.status === 404) {
    return (
      <>
        <BackLink {...back} />
        <NotFound title="Mijoz topilmadi" description="Bu mijoz o'chirilgan yoki sizning kompaniyangizniki emas." />
      </>
    )
  }
  // The page needs all three: the customer, and what its answers are read
  // with. One that failed fails the page; trying again asks for them all.
  const queries = [customer, types, dropdowns]
  const failed = queries.find((query) => query.isError)
  if (!customer.data || !types.data || !dropdowns.data) {
    return (
      <>
        <PageTitle title="Mijoz" back={back} />
        {failed?.error ? (
          <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <ListLoading rows={4} mark="none" />
        )}
      </>
    )
  }
  const type = types.data.find((candidate) => candidate.id === customer.data.type_id)
  const name = customerName(customer.data, type)
  const phone = formatPhone(customer.data.phone)

  return (
    <>
      <PageTitle
        back={back}
        title={name ?? phone}
        // A customer with no name goes by the phone, which is then not said twice.
        description={[name ? phone : null, type?.name].filter(Boolean).join(" · ")}
        action={
          <PageActions>
            {type && allowed("customers.edit") && <PageAction icon={PencilIcon} label="Tahrirlash" onClick={() => setEditing(true)} />}
            {allowed("sales.create") && <PageAction icon={BanknoteIcon} label="To'lov" onClick={() => setPaying(true)} />}
            {allowed("orders.create") && locationId !== null && <PageAction icon={ClipboardPlusIcon} label="Buyurtma" onClick={() => setOrdering(true)} />}
            <PageAction icon={PhoneIcon} label="Qo'ng'iroq" href={`tel:+${customer.data.phone}`} />
          </PageActions>
        }
      />
      {companyId !== null && (
        <CustomerStats
          companyId={companyId}
          customerId={customer.data.id}
          balance={allowed("sales.view") ? customer.data.balance : null}
          byCurrency={customer.data.balance_by_currency ?? null}
          orders={allowed("orders.view")}
          sales={allowed("sales.view")}
        />
      )}
      <InPageTabs
        label="Mijoz"
        tabs={[
          {
            value: "info",
            label: "Ma'lumot",
            content: (
              <section aria-label="Ma'lumot">
                <Group as="dl">
                  <KeyValue label="Telefon" value={phone} />
                  {type?.fields.map((field) => (
                    <KeyValue key={field.id} label={field.label} value={answerText(field, customer.data.values[field.id], dropdowns.data)} />
                  ))}
                  <KeyValue label="Qo'shgan" value={customer.data.created_by_name} />
                  <KeyValue label="Qo'shilgan" value={formatDate(customer.data.created_at)} />
                </Group>
              </section>
            ),
          },
          // The orders the customer has (for whoever may see the orders): a customer with one is not deleted.
          ...(companyId !== null && allowed("orders.view")
            ? [{ value: "orders", label: "Buyurtmalar", content: <CustomerOrders companyId={companyId} customerId={customer.data.id} /> }]
            : []),
          // Every document that names the customer, and the dialogs that add one (logic/sales.md, section 5).
          ...(companyId !== null && allowed("sales.view")
            ? [
                {
                  value: "statement",
                  label: "Hisob harakati",
                  content: (
                    <StatementList
                      party="customer"
                      companyId={companyId}
                      partyId={customer.data.id}
                      canAdd={allowed("sales.create")}
                      canEdit={allowed("sales.edit")}
                      canDelete={allowed("sales.delete")}
                    />
                  ),
                },
              ]
            : []),
          // Who did what to the customer takes its permission.
          ...(companyId !== null && allowed("customers.history")
            ? [{ value: "history", label: "Tarix", content: <CustomerHistory companyId={companyId} id={customer.data.id} /> }]
            : []),
        ]}
      />
      {companyId !== null && allowed("customers.delete") && <DeleteCustomerButton companyId={companyId} id={customer.data.id} name={name ?? phone} />}
      {paying && companyId !== null && (
        <PaymentDialog
          party="customer"
          companyId={companyId}
          partyId={customer.data.id}
          partyName={name ?? phone}
          owed={customer.data.balance}
          open
          onOpenChange={(open) => !open && setPaying(false)}
        />
      )}
      {ordering && companyId !== null && locationId !== null && (
        <NewOrder
          companyId={companyId}
          locationId={locationId}
          canCreateCustomer={allowed("customers.create")}
          customer={customer.data}
          onClose={() => setOrdering(false)}
        />
      )}
      {editing && companyId !== null && type && (
        <EditCustomerDialog
          companyId={companyId}
          customer={customer.data}
          type={type}
          dropdowns={dropdowns.data}
          open
          onOpenChange={(open) => !open && setEditing(false)}
        />
      )}
    </>
  )
}

// CustomerStats are the customer's figure cards, as the prototype's: what
// they owe, how many orders they have and how many sales, each to whoever
// may see it.
function CustomerStats({
  companyId,
  customerId,
  balance,
  byCurrency,
  orders,
  sales,
}: {
  companyId: number
  customerId: number
  balance: string | null
  byCurrency: BalanceLine[] | null
  orders: boolean
  sales: boolean
}) {
  const orderList = useOrders(orders ? companyId : null, { locationId: null, search: "", typeId: null, stageId: null, assignee: "", customerId, page: 1 })
  const saleList = useSales(sales ? companyId : null, { locationId: null, customerId, page: 1 })
  if (balance === null && !orders && !sales) return null
  return (
    <StatCards three>
      {balance !== null && <BalanceStat balance={balance} byCurrency={byCurrency} />}
      {orders && <StatCard label="Buyurtmalar" value={orderList.data?.total ?? "…"} />}
      {sales && <StatCard label="Sotuvlar" value={saleList.data?.total ?? "…"} />}
    </StatCards>
  )
}
