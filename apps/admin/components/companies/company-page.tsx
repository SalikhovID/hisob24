"use client"

import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Failed, Loading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { formatDate, formatPhone } from "@/lib/format"
import { useCompany } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import type { Member } from "@/lib/types"
import { CompanyStatusBadge } from "./status-badge"

const memberColumns: Column<Member>[] = [
  { header: "Telefon", cell: (m) => formatPhone(m.phone), primary: true },
  { header: "Ism", cell: (m) => m.full_name ?? "—" },
  { header: "Rol", cell: (m) => roleLabels[m.role] },
]

// CompanyPage shows one company: its details and its users.
export function CompanyPage({ id }: { id: number }) {
  const company = useCompany(id)
  const infoId = useId()
  const usersId = useId()

  if (company.isPending) return <Loading />
  if (company.error instanceof ApiError && company.error.status === 404) return <NotFound />
  if (company.isError) return <Failed error={company.error} onRetry={() => company.refetch()} />
  const c = company.data

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" />
          Kompaniyalar
        </Link>
        <h1 className="text-xl font-semibold break-words">{c.name}</h1>
      </div>
      <section aria-labelledby={infoId} className="rounded-xl border bg-card p-4">
        <h2 id={infoId} className="mb-3 font-medium">
          Ma&apos;lumot
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Detail label="Tugash sanasi">{formatDate(c.end_date)}</Detail>
          <Detail label="Holat">
            <CompanyStatusBadge company={c} />
          </Detail>
          <Detail label="Yaratilgan">{formatDate(c.created_at)}</Detail>
        </dl>
      </section>
      <section aria-labelledby={usersId} className="space-y-3">
        <h2 id={usersId} className="font-medium">
          Userlar
        </h2>
        <DataList label="Userlar" items={c.users} columns={memberColumns} getKey={(m) => m.phone} />
      </section>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <h1 className="text-xl font-semibold">Kompaniya topilmadi</h1>
      <p className="text-sm text-muted-foreground">U o&apos;chirilgan yoki havola noto&apos;g&apos;ri.</p>
      <Link href="/companies" className={buttonVariants({ variant: "outline" })}>
        Kompaniyalar ro&apos;yxatiga
      </Link>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
