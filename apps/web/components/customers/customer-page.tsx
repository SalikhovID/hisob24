"use client"

import { Avatar } from "@/components/avatar"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { ApiError } from "@/lib/api"
import { answerText, customerName } from "@/lib/customers"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useCustomer, useCustomerDropdowns, useCustomerTypes, useMe } from "@/lib/queries"
import { CustomerHistory } from "./customer-history"
import { DeleteCustomerButton } from "./delete-customer-button"
import { EditCustomerDialog } from "./edit-customer-dialog"

const back = { href: "/customers", label: "Mijozlar" }

// A line of the customer's facts: what it is, and the value, a dash where
// there is none.
function Fact({ name, value }: { name: string; value: string | null }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <dt className="text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">{name}</dt>
      <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">
        {value === null || value === "" ? <span className="text-muted-foreground">—</span> : value}
      </dd>
    </div>
  )
}

// CustomerPage is one customer of the company, for every member of it: who
// it is, its answer to every field of its type, in the type's order, and who
// entered it and when.
export function CustomerPage({ id }: { id: number }) {
  const me = useMe()
  const companyId = me.data?.company?.id ?? null
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
          companyId !== null && (
            <>
              {type && (
                <EditCustomerDialog companyId={companyId} customer={customer.data} type={type} dropdowns={dropdowns.data} />
              )}
              <DeleteCustomerButton companyId={companyId} id={customer.data.id} name={name ?? phone} />
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
      {/* Who did what to the customer is the owner's to see. */}
      {companyId !== null && me.data?.company?.role === "owner" && (
        <CustomerHistory companyId={companyId} id={customer.data.id} />
      )}
    </div>
  )
}
