"use client"

import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { answerText, customerName, fieldColumns } from "@/lib/customers"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useCustomerDropdowns, useCustomers, useCustomerTypes, useMe } from "@/lib/queries"
import type { Customer } from "@/lib/types"
import { SearchInput } from "./search-input"
import { useCustomerFilter } from "./use-customer-filter"

// A tab is quiet until it is the chosen one, which then stands out as a card
// on the muted strip. Never the brand color: that is the page's one button.
const tab = "px-3 text-muted-foreground data-active:bg-card"

// CustomersPage is the company's customers, for every member of it: the
// newest first, each under the name it goes by (its answer to its type's
// first text field) over its phone, with its answers to the other fields.
// Fields of one name share a column, whatever the type.
export function CustomersPage() {
  const me = useMe()
  const companyId = me.data?.company?.id ?? null
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const [filter, update] = useCustomerFilter()
  const customers = useCustomers(companyId, filter)

  const typeOf = (customer: Customer) => types.data?.find((type) => type.id === customer.type_id)
  // Under a tab the list is of one type: its fields are the columns, and the
  // type is not said in every row.
  const everyType = filter.typeId === null
  const shownTypes = (types.data ?? []).filter((type) => everyType || type.id === filter.typeId)

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
    ...(everyType
      ? [
          {
            key: "type",
            header: "Turi",
            card: "tag",
            cell: (c) => {
              const type = typeOf(c)
              return type && <Badge variant="secondary">{type.name}</Badge>
            },
          } satisfies Column<Customer>,
        ]
      : []),
    ...fieldColumns(shownTypes).map(
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
  // How many customers the company has is the unfiltered list's total: under
  // a tab or a search the API counts the matches only. The total is kept from
  // the last unfiltered answer, so a filtered number never stands in for it.
  const unfiltered = everyType && !filter.search
  const [total, setTotal] = useState<number>()
  if (unfiltered && customers.data && !customers.isPlaceholderData && customers.data.total !== total) {
    setTotal(customers.data.total)
  }
  // The answer on screen while the next one loads is the previous filter's.
  // A list of it can stay; "nothing found" cannot: it would be said of a
  // filter that has not answered yet.
  const settling = customers.isPlaceholderData && customers.data?.total === 0
  const loading = !failed && (queries.some((query) => query.isPending) || settling)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mijozlar"
        description={
          unfiltered && total !== undefined ? `Kompaniyangiz mijozlari · ${total} ta` : "Kompaniyangiz mijozlari"
        }
      />
      <div className="space-y-3">
        {types.data && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Types are the owner's to make: there may be many, and the strip
                of them scrolls sideways rather than squeezing. */}
            <div className="-mx-1 min-w-0 overflow-x-auto px-1 py-0.5 scrollbar-hide">
              <Tabs
                value={filter.typeId === null ? "all" : String(filter.typeId)}
                onValueChange={(value) => update({ typeId: value === "all" ? null : Number(value) })}
              >
                <TabsList className="group-data-horizontal/tabs:h-9 max-sm:min-w-full">
                  <TabsTrigger value="all" className={tab}>
                    Barchasi
                  </TabsTrigger>
                  {types.data.map((type) => (
                    <TabsTrigger key={type.id} value={String(type.id)} className={tab}>
                      {type.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <SearchInput value={filter.search} onSearch={(search) => update({ search })} />
          </div>
        )}
        {loading && <ListLoading rows={6} />}
        {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
        {!loading && !failed && customers.data?.total === 0 && (
          <EmptyState
            title={unfiltered ? "Hali mijoz yo'q" : "Mijozlar topilmadi"}
            description={
              unfiltered
                ? "Birinchi mijozni «Mijoz qo'shish» tugmasi orqali qo'shing."
                : "Qidiruv yoki filtrni o'zgartirib ko'ring."
            }
          />
        )}
        {!loading && !failed && customers.data && customers.data.total > 0 && (
          <DataList
            label="Mijozlar"
            items={customers.data.items}
            columns={columns}
            getKey={(c) => c.id}
            footer={
              <Pager
                page={customers.data.page}
                pageSize={customers.data.page_size}
                total={customers.data.total}
                onPage={(page) => update({ page })}
              />
            }
          />
        )}
      </div>
    </div>
  )
}
