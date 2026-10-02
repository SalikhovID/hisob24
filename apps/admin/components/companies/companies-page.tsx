"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { type Column, DataList } from "@/components/data-list"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { useCompanies } from "@/lib/queries"
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
      <SearchInput value={filter.search} onSearch={(search) => update({ search })} />
      {companies.data && (
        <DataList
          label="Kompaniyalar"
          items={companies.data.items}
          columns={columns}
          getKey={(c) => c.id}
          href={(c) => `/companies/${c.id}`}
        />
      )}
    </div>
  )
}
