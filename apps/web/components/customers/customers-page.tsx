"use client"

import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { answerText, customerName, fieldColumns } from "@/lib/customers"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useCustomerDropdowns, useCustomers, useCustomerTypes, useMe } from "@/lib/queries"
import type { Customer } from "@/lib/types"

// CustomersPage is the company's customers, for every member of it: the
// newest first, each under the name it goes by (its answer to its type's
// first text field) over its phone, with its answers to the other fields.
// Fields of one name share a column, whatever the type.
export function CustomersPage() {
  const me = useMe()
  const companyId = me.data?.company?.id ?? null
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const customers = useCustomers(companyId, { search: "", typeId: null, page: 1 })

  const typeOf = (customer: Customer) => types.data?.find((type) => type.id === customer.type_id)

  const columns: Column<Customer>[] = [
    {
      key: "customer",
      header: "Mijoz",
      primary: true,
      // A customer with no name goes by the phone, which then is not said twice.
      cell: (c) => {
        const name = customerName(c, typeOf(c))
        return (
          <Identity
            title={name ?? formatPhone(c.phone)}
            subtitle={name ? formatPhone(c.phone) : undefined}
            name={name}
            seed={c.id}
            href={`/customers/${c.id}`}
          />
        )
      },
    },
    {
      key: "type",
      header: "Turi",
      card: "tag",
      cell: (c) => {
        const type = typeOf(c)
        return type && <Badge variant="secondary">{type.name}</Badge>
      },
    },
    ...fieldColumns(types.data ?? []).map(
      (column): Column<Customer> => ({
        key: column.key,
        header: column.label,
        // A long answer wraps inside its cell; it does not stretch the table.
        className: "max-w-64 whitespace-normal [overflow-wrap:anywhere]",
        cell: (c) => {
          const field = column.fields[c.type_id]
          return field && answerText(field, c.values[field.id], dropdowns.data ?? [])
        },
      }),
    ),
    { key: "created_by", header: "Qo'shgan", className: "text-muted-foreground", cell: (c) => c.created_by_name },
    {
      key: "created_at",
      header: "Qo'shilgan",
      card: "inline",
      className: "text-muted-foreground",
      cell: (c) => formatDate(c.created_at),
    },
  ]

  // The list needs all three: the customers, and what their answers are
  // read with. One that failed fails the list; trying again asks for them all.
  const queries = [customers, types, dropdowns]
  const failed = queries.find((query) => query.isError)
  const loading = !failed && queries.some((query) => query.isPending)
  const total = customers.data?.total

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mijozlar"
        description={total !== undefined ? `Kompaniyangiz mijozlari · ${total} ta` : "Kompaniyangiz mijozlari"}
      />
      {loading && <ListLoading rows={6} />}
      {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
      {!loading && !failed && total === 0 && (
        <EmptyState title="Hali mijoz yo'q" description="Birinchi mijozni «Mijoz qo'shish» tugmasi orqali qo'shing." />
      )}
      {!loading && !failed && customers.data && customers.data.total > 0 && (
        <DataList label="Mijozlar" items={customers.data.items} columns={columns} getKey={(c) => c.id} />
      )}
    </div>
  )
}
