"use client"

import { Avatar } from "@/components/avatar"
import { PageHeader } from "@/components/page-header"
import { answerText, customerName } from "@/lib/customers"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useCustomer, useCustomerDropdowns, useCustomerTypes, useMe } from "@/lib/queries"

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

  if (!customer.data || !types.data || !dropdowns.data) return null
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
    </div>
  )
}
