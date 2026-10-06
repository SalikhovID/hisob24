"use client"

import { Avatar } from "@/components/avatar"
import { Fact } from "@/components/facts"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { ApiError } from "@/lib/api"
import { customerName } from "@/lib/customers"
import { answerText } from "@/lib/fields"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { can } from "@/lib/permissions"
import { useCustomer, useCustomerDropdowns, useCustomerTypes } from "@/lib/queries"
import type { Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { CustomerHistory } from "./customer-history"
import { CustomerTasks } from "./customer-tasks"
import { DeleteCustomerButton } from "./delete-customer-button"
import { EditCustomerDialog } from "./edit-customer-dialog"

const back = { href: "/customers", label: "Mijozlar" }

// CustomerPage is one customer of the company, for whoever may see the
// customers (changing, deleting, the history and the tasks each take their
// permission): who it is, its answer to every field of its type, in the type's order, and who
// entered it and when.
export function CustomerPage({ id }: { id: number }) {
  const gate = usePermission("customers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const customer = useCustomer(companyId, id)
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)

  // A customer that is gone, or is another company's, is not found: there
  // is nothing to try again.
  if (customer.error instanceof ApiError && customer.error.status === 404) {
    return (
      <PageHeader
        title="Mijoz topilmadi"
        description="Bu mijoz o'chirilgan yoki sizning kompaniyangizniki emas."
        back={back}
      />
    )
  }
  // The page needs all three: the customer, and what its answers are read
  // with. One that failed fails the page; trying again asks for them all.
  const queries = [customer, types, dropdowns]
  const failed = queries.find((query) => query.isError)
  if (!customer.data || !types.data || !dropdowns.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mijoz" back={back} />
        {failed?.error ? (
          <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />
        ) : (
          <ListLoading rows={4} mark="none" />
        )}
      </div>
    )
  }
  const type = types.data.find((candidate) => candidate.id === customer.data.type_id)
  const name = customerName(customer.data, type)
  const phone = formatPhone(customer.data.phone)

  return (
    <div className="space-y-5">
      <PageHeader
        title={name ?? phone}
        // A customer with no name goes by the phone, which is then not said twice.
        description={[type?.name, name ? phone : null].filter(Boolean).join(" · ")}
        back={back}
        avatar={<Avatar name={name} seed={customer.data.id} />}
        stack
        actions={
          companyId !== null &&
          (allowed("customers.edit") || allowed("customers.delete")) && (
            <>
              {type && allowed("customers.edit") && (
                <EditCustomerDialog companyId={companyId} customer={customer.data} type={type} dropdowns={dropdowns.data} />
              )}
              {allowed("customers.delete") && <DeleteCustomerButton companyId={companyId} id={customer.data.id} name={name ?? phone} />}
            </>
          )
        }
      />
      <section aria-labelledby="customer-info" className="space-y-3">
        <h2 id="customer-info" className="text-base font-semibold">
          Ma&apos;lumot
        </h2>
        <dl className="divide-y rounded-xl border bg-card tabular-nums">
          <Fact name="Telefon" value={phone} />
          {type?.fields.map((field) => (
            <Fact key={field.id} name={field.label} value={answerText(field, customer.data.values[field.id], dropdowns.data)} />
          ))}
          <Fact name="Qo'shgan" value={customer.data.created_by_name} />
          <Fact name="Qo'shilgan" value={formatDate(customer.data.created_at)} />
        </dl>
      </section>
      {/* The tasks the customer has (for whoever may see the tasks): a customer with one is not deleted. */}
      {companyId !== null && allowed("tasks.view") && <CustomerTasks companyId={companyId} customerId={customer.data.id} />}
      {/* Who did what to the customer takes its permission. */}
      {companyId !== null && allowed("customers.history") && (
        <CustomerHistory companyId={companyId} id={customer.data.id} />
      )}
    </div>
  )
}
