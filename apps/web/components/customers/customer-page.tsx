"use client"

import { ClipboardPlusIcon, PencilIcon, PhoneIcon } from "lucide-react"
import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { DetailHead, Tile, Tiles } from "@/components/kit/detail-head"
import { Group, KeyValue, SectionHeading } from "@/components/kit/group"
import { BackLink, PageTitle } from "@/components/kit/page-title"
import { Failed, ListLoading, NotFound } from "@/components/states"
import { NewTask } from "@/components/tasks/new-task"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { answerText } from "@/lib/fields"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { can } from "@/lib/permissions"
import { useCustomer, useCustomerDropdowns, useCustomerTypes } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { BalanceCard } from "@/components/warehouse/balance-card"
import { StatementList } from "@/components/warehouse/statement-list"
import { CustomerHistory } from "./customer-history"
import { CustomerTasks } from "./customer-tasks"
import { DeleteCustomerButton } from "./delete-customer-button"
import { EditCustomerDialog } from "./edit-customer-dialog"

const back = { href: "/customers", label: "Mijozlar" }

// CustomerPage is one customer of the company, for whoever may see the
// customers (changing, deleting, the history and the tasks each take their
// permission), as the prototype's page: who it is (its avatar, its name,
// its type and phone), the tiles (editing, a task for it, a call to its
// phone), its answer
// to every field of its type in the type's order with who entered it and
// when; for whoever may see the sales, what they owe and their statement
// (logic/sales.md, section 5); its tasks, its history, and at the foot the
// way to delete it.
export function CustomerPage({ id }: { id: number }) {
  const gate = usePermission("customers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const customer = useCustomer(companyId, id)
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const [editing, setEditing] = useState(false)
  const [tasking, setTasking] = useState(false)
  // A task for the customer goes into the current location.
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
      <BackLink {...back} />
      <DetailHead
        media={<Avatar name={name} seed={customer.data.id} size="lg" />}
        title={name ?? phone}
        // A customer with no name goes by the phone, which is then not said twice.
        description={[type?.name, name ? phone : null].filter(Boolean).join(" · ")}
      />
      <Tiles>
        {type && allowed("customers.edit") && <Tile icon={PencilIcon} label="Tahrirlash" onClick={() => setEditing(true)} />}
        {allowed("tasks.create") && locationId !== null && <Tile icon={ClipboardPlusIcon} label="Vazifa" onClick={() => setTasking(true)} />}
        <Tile icon={PhoneIcon} label="Qo'ng'iroq" href={`tel:+${customer.data.phone}`} />
      </Tiles>
      {allowed("sales.view") && customer.data.balance !== null && (
        <BalanceCard balance={customer.data.balance} byCurrency={customer.data.balance_by_currency ?? null} />
      )}
      <section aria-label="Ma'lumot">
        <SectionHeading>Ma&apos;lumot</SectionHeading>
        <Group as="dl">
          <KeyValue label="Telefon" value={phone} />
          {type?.fields.map((field) => (
            <KeyValue key={field.id} label={field.label} value={answerText(field, customer.data.values[field.id], dropdowns.data)} />
          ))}
          <KeyValue label="Qo'shgan" value={customer.data.created_by_name} />
          <KeyValue label="Qo'shilgan" value={formatDate(customer.data.created_at)} />
        </Group>
      </section>
      {/* Every document that names the customer, and the dialogs that add one (logic/sales.md, section 5). */}
      {companyId !== null && allowed("sales.view") && (
        <StatementList
          party="customer"
          companyId={companyId}
          partyId={customer.data.id}
          canAdd={allowed("sales.create")}
          canEdit={allowed("sales.edit")}
          canDelete={allowed("sales.delete")}
        />
      )}
      {/* The tasks the customer has (for whoever may see the tasks): a customer with one is not deleted. */}
      {companyId !== null && allowed("tasks.view") && <CustomerTasks companyId={companyId} customerId={customer.data.id} />}
      {/* Who did what to the customer takes its permission. */}
      {companyId !== null && allowed("customers.history") && <CustomerHistory companyId={companyId} id={customer.data.id} />}
      {companyId !== null && allowed("customers.delete") && <DeleteCustomerButton companyId={companyId} id={customer.data.id} name={name ?? phone} />}
      {tasking && companyId !== null && locationId !== null && (
        <NewTask
          companyId={companyId}
          locationId={locationId}
          canCreateCustomer={allowed("customers.create")}
          customer={customer.data}
          onClose={() => setTasking(false)}
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
