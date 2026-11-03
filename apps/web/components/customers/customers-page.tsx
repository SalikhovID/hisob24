"use client"

import { SearchIcon, SlidersHorizontalIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { ChoiceChips } from "@/components/kit/chips"
import { type Column, DataTable } from "@/components/kit/data-table"
import { Foot } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { SearchBox } from "@/components/kit/search-box"
import { Toolbar } from "@/components/kit/toolbar"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, ListLoading } from "@/components/states"
import { customerName } from "@/lib/customers"
import { formatPhone } from "@/lib/phone"
import { can } from "@/lib/permissions"
import { useCustomerDropdowns, useCustomers, useCustomerTypes } from "@/lib/queries"
import type { Customer, Permission } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { cn } from "@/lib/utils"
import { balanceText } from "@/lib/warehouse"
import { AddCustomerDialog } from "./add-customer-dialog"
import { useCustomerFilter } from "./use-customer-filter"
import { count, formatAmount, formatDate } from "@/lib/format"

// CustomersPage is the company's customers, for whoever may see them
// (customers.view; adding takes customers.create), as the prototype's list:
// the newest first, a row each (its name over its phone and, among every
// type, its type; what it owes, to whoever sees the sales), a chip per type,
// a search by name or phone, twenty to a page. The answers are the
// customer's page's.
export function CustomersPage() {
  const gate = usePermission("customers.view")
  const companyId = gate?.company.id ?? null
  const allowed = (permission: Permission) => can(gate?.permissions, permission)
  const types = useCustomerTypes(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const [filter, update] = useCustomerFilter()
  const customers = useCustomers(companyId, filter)
  const [adding, setAdding] = useState(false)

  const typeOf = (customer: Customer) => types.data?.find((type) => type.id === customer.type_id)
  // Under a type the list is of one type: the type is not said in every row.
  const everyType = filter.typeId === null

  // The list needs all three: the customers, and what their answers are
  // read with. One that failed fails the list; trying again asks for them all.
  const queries = [customers, types, dropdowns]
  const failed = queries.find((query) => query.isError)
  // How many customers the company has is the unfiltered list's total: under
  // a type or a search the API counts the matches only. The total is kept
  // from the last unfiltered answer, so a filtered number never stands in
  // for it.
  const unfiltered = everyType && !filter.search
  const [total, setTotal] = useState<number>()
  if (unfiltered && customers.data && !customers.isPlaceholderData && customers.data.total !== total) {
    setTotal(customers.data.total)
  }
  // The answer on screen while the next one loads is the previous filter's.
  // A list of it can stay; "nothing found" cannot: it would be said of a
  // filter that has not answered yet.
  const settling = customers.isPlaceholderData && customers.data?.total === 0
  const settingsAllowed = allowed("settings.view")
  const noTypes = !failed && types.data?.length === 0
  const loading = !failed && (queries.some((query) => query.isPending) || settling)
  const canAdd = companyId !== null && allowed("customers.create") && !!types.data?.length && !!dropdowns.data

  // The web's table: who (the avatar, the name, the phone), the type, what
  // they owe (to whoever sees the sales: red owed, green ahead, a dash even),
  // who added them and when.
  const columns: Column<Customer>[] = [
    {
      key: "customer",
      label: "Mijoz",
      render: (customer) => {
        const name = customerName(customer, typeOf(customer))
        const phone = formatPhone(customer.phone)
        return (
          <span className="flex items-center gap-2.5">
            <Avatar name={name} />
            <span className="grid min-w-0 leading-[1.3]">
              <span className="truncate font-medium">{name ?? phone}</span>
              {name && <span className="truncate text-[12px] text-muted-foreground">{phone}</span>}
            </span>
          </span>
        )
      },
    },
    { key: "type", label: "Turi", render: (customer) => typeOf(customer)?.name ?? "" },
    ...(allowed("sales.view") ? [{ key: "debt", label: "Qarz", align: "end" as const, render: (customer: Customer) => debtCell(customer.balance) }] : []),
    { key: "by", label: "Qo'shgan", render: (customer) => customer.created_by_name ?? "" },
    { key: "at", label: "Qo'shilgan", render: (customer) => formatDate(customer.created_at) },
  ]

  // Until the session is known to be let in there is nothing to show; a
  // stranger is on their way home.
  if (!gate) return null
  const page = customers.data
  return (
    <>
      <PageTitle
        title="Mijozlar"
        description={unfiltered && total !== undefined ? `Kompaniyangiz mijozlari · ${count(total)}` : "Kompaniyangiz mijozlari"}
        action={canAdd && <PlusButton label="Mijoz qo'shish" onClick={() => setAdding(true)} />}
      />
      {noTypes ? (
        // A customer is of a type: with none there is nothing to enter, to
        // filter or to search. The types are the settings' to make.
        <EmptyState
          icon={SlidersHorizontalIcon}
          title="Sozlama yetishmaydi"
          description={settingsAllowed ? "Avval mijoz turlarini sozlang." : "Kompaniya egasi mijoz turlarini sozlashi kerak."}
          action={
            settingsAllowed && (
              <Link href="/settings" className="inline-flex h-[46px] items-center rounded-full bg-primary text-primary-foreground px-[22px] text-[16px] font-semibold">
                Sozlamalarni ochish
              </Link>
            )
          }
        />
      ) : (
        <>
          <Toolbar>
            <SearchBox value={filter.search} onSearch={(search) => update({ search })} />
            {types.data && types.data.length > 0 && (
              <ChoiceChips
                label="Mijoz turi"
                value={filter.typeId === null ? "all" : String(filter.typeId)}
                onChange={(value) => update({ typeId: value === "all" ? null : Number(value) })}
                options={[{ value: "all", label: "Barchasi" }, ...types.data.map((type) => ({ value: String(type.id), label: type.name }))]}
              />
            )}
          </Toolbar>
          {loading && <ListLoading rows={6} />}
          {failed?.error && <Failed error={failed.error} onRetry={() => queries.forEach((query) => query.refetch())} />}
          {!loading && !failed && page?.total === 0 && (
            <EmptyState
              icon={unfiltered ? UsersIcon : SearchIcon}
              title={unfiltered ? "Hali mijoz yo'q" : "Mijozlar topilmadi"}
              description={unfiltered ? "Birinchi mijozni «Mijoz qo'shish» tugmasi orqali qo'shing." : "Qidiruv yoki filtrni o'zgartirib ko'ring."}
              action={unfiltered && canAdd && <MainButton onClick={() => setAdding(true)} className="px-5">Mijoz qo&apos;shish</MainButton>}
            />
          )}
          {!loading && !failed && page && page.total > 0 && (
            <>
              <div className={cn(customers.isPlaceholderData && "opacity-60")}>
                <DataTable
                  label="Mijozlar"
                  rows={page.items}
                  rowKey={(customer) => customer.id}
                  href={(customer) => `/customers/${customer.id}`}
                  columns={columns}
                  mobileRow={(customer) => {
                    const type = typeOf(customer)
                    const name = customerName(customer, type)
                    const phone = formatPhone(customer.phone)
                    // A customer with no name goes by the phone, which then is not said twice.
                    const sub = [name ? phone : null, everyType ? type?.name : null].filter(Boolean).join(" · ")
                    const balance = customer.balance === null ? null : balanceText(customer.balance)
                    return {
                      lead: <Avatar name={name} />,
                      title: name ?? phone,
                      sub: sub || undefined,
                      end:
                        balance && balance.kind !== "none" ? (
                          <span className={cn("text-md", balance.kind === "debt" ? "text-destructive" : "text-positive")}>{balance.text}</span>
                        ) : undefined,
                    }
                  }}
                />
              </div>
              {page.total > page.page_size ? (
                <Pager page={page.page} pageSize={page.page_size} total={page.total} onPage={(next) => update({ page: next })} />
              ) : (
                <Foot>Jami: {page.total}</Foot>
              )}
            </>
          )}
        </>
      )}
      {adding && companyId !== null && types.data && dropdowns.data && (
        <AddCustomerDialog
          companyId={companyId}
          types={types.data}
          dropdowns={dropdowns.data}
          typeId={filter.typeId}
          open
          onOpenChange={(open) => !open && setAdding(false)}
        />
      )}
    </>
  )
}

// debtCell is what a customer owes as the table says it: the debt in red,
// an advance in green («Avans N so'm»), a dash when even.
function debtCell(balance: string | null) {
  const value = Number(balance ?? 0)
  if (value > 0) return <span className="text-destructive">{`${formatAmount(balance!)} so'm`}</span>
  if (value < 0) return <span className="text-positive">{`Avans ${formatAmount(balance!.replace("-", ""))} so'm`}</span>
  return <span className="text-faint">—</span>
}
