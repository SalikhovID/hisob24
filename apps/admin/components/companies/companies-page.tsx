"use client"

import { Building2Icon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { Pager } from "@/components/pager"
import { EmptyState, Failed, Loading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/format"
import { type CompanyFilter, useCompanies } from "@/lib/queries"
import type { Company } from "@/lib/types"
import { SearchInput } from "./search-input"
import { CompanyStatusBadge } from "./status-badge"
import { useCompanyFilter } from "./use-company-filter"

const columns: Column<Company>[] = [
  {
    header: "Nomi",
    primary: true,
    // The name is the way into the company; the day it was created tells
    // two companies of one name apart.
    cell: (c) => (
      <Identity
        title={c.name}
        subtitle={`Yaratilgan ${formatDate(c.created_at)}`}
        seed={c.id}
        icon={Building2Icon}
        square
        href={`/companies/${c.id}`}
      />
    ),
  },
  { header: "Tugash sanasi", card: "inline", cell: (c) => formatDate(c.end_date) },
  { header: "Holat", card: "tag", cell: (c) => <CompanyStatusBadge company={c} /> },
]

// CompaniesPage lists the companies, newest first, to search through.
export function CompaniesPage() {
  const [filter, update] = useCompanyFilter()
  const companies = useCompanies(filter)
  // How many companies the platform has is the unfiltered list's total: under
  // a tab or a search the API counts the matches only (the pager shows
  // those). The total is kept from the last unfiltered answer, so it does
  // not blink while pages turn, and a filtered number never stands in for it.
  const unfiltered = !filter.status && !filter.search
  const [total, setTotal] = useState<number>()
  if (unfiltered && companies.data && !companies.isPlaceholderData && companies.data.total !== total) {
    setTotal(companies.data.total)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kompaniyalar"
        description={
          unfiltered && total !== undefined ? `Platformadagi kompaniyalar · ${total} ta` : "Platformadagi kompaniyalar"
        }
        actions={
          <Link href="/companies/new" className={buttonVariants()}>
            <PlusIcon />
            Yangi kompaniya
          </Link>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter.status || "all"}
          onValueChange={(value) => update({ status: value === "all" ? "" : (value as CompanyFilter["status"]) })}
        >
          <TabsList>
            <TabsTrigger value="all">Hammasi</TabsTrigger>
            <TabsTrigger value="active">Faol</TabsTrigger>
            <TabsTrigger value="expired">Muddati o&apos;tgan</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={filter.search} onSearch={(search) => update({ search })} />
      </div>
      {companies.isPending && <Loading />}
      {companies.isError && <Failed error={companies.error} onRetry={() => companies.refetch()} />}
      {companies.data?.total === 0 && (
        <EmptyState title="Kompaniyalar topilmadi" description="Qidiruv yoki filtrni o'zgartirib ko'ring." />
      )}
      {companies.data && companies.data.total > 0 && (
        <>
          <DataList
            label="Kompaniyalar"
            items={companies.data.items}
            columns={columns}
            getKey={(c) => c.id}
          />
          <Pager
            page={companies.data.page}
            pageSize={companies.data.page_size}
            total={companies.data.total}
            onPage={(page) => update({ page })}
          />
        </>
      )}
    </div>
  )
}
