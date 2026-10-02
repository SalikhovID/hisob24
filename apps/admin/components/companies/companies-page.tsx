"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { type Column, DataList } from "@/components/data-list"
import { Pager } from "@/components/pager"
import { Empty, Failed, Loading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/format"
import { type CompanyFilter, useCompanies } from "@/lib/queries"
import type { Company } from "@/lib/types"
import { SearchInput } from "./search-input"
import { CompanyStatusBadge } from "./status-badge"
import { useCompanyFilter } from "./use-company-filter"

const columns: Column<Company>[] = [
  { header: "Nomi", cell: (c) => c.name, primary: true },
  { header: "Tugash sanasi", cell: (c) => formatDate(c.end_date) },
  { header: "Holat", cell: (c) => <CompanyStatusBadge company={c} /> },
]

// CompaniesPage lists the companies, newest first, to search through.
export function CompaniesPage() {
  const [filter, update] = useCompanyFilter()
  const companies = useCompanies(filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Kompaniyalar</h1>
        <Link href="/companies/new" className={buttonVariants()}>
          <PlusIcon />
          Yangi kompaniya
        </Link>
      </div>
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
      {companies.data?.total === 0 && <Empty>Kompaniyalar topilmadi</Empty>}
      {companies.data && companies.data.total > 0 && (
        <>
          <DataList
            label="Kompaniyalar"
            items={companies.data.items}
            columns={columns}
            getKey={(c) => c.id}
            href={(c) => `/companies/${c.id}`}
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
