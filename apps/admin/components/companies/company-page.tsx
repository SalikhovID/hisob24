"use client"

import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { RoleBadge } from "@/components/role-badge"
import { Failed, Loading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { formatDate, formatPhone } from "@/lib/format"
import { useCompany } from "@/lib/queries"
import type { Member } from "@/lib/types"
import { AddBillingDialog } from "./add-billing-dialog"
import { BillingHistory } from "./billing-history"
import { CompanyActions } from "./company-actions"
import { RenameDialog } from "./rename-dialog"
import { ReplaceOwnerDialog } from "./replace-owner-dialog"
import { CompanyStatusBadge } from "./status-badge"

const memberColumns: Column<Member>[] = [
  {
    header: "A'zo",
    primary: true,
    // A member with no name goes by the phone, which then is not said twice.
    cell: (m) => (
      <Identity
        title={m.full_name ?? formatPhone(m.phone)}
        subtitle={m.full_name ? formatPhone(m.phone) : undefined}
        name={m.full_name}
        seed={m.phone}
      />
    ),
  },
  { header: "Rol", card: "tag", cell: (m) => <RoleBadge role={m.role} /> },
  { header: "Qo'shilgan", card: "inline", className: "text-muted-foreground", cell: (m) => formatDate(m.created_at) },
]

// CompanyPage shows one company: its details and its users.
export function CompanyPage({ id }: { id: number }) {
  const company = useCompany(id)
  const infoId = useId()
  const usersId = useId()
  const billingId = useId()

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold break-words">{c.name}</h1>
          <div className="flex flex-wrap gap-2">
            <RenameDialog company={c} />
            <CompanyActions company={c} />
          </div>
        </div>
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
        <div className="flex items-center justify-between gap-3">
          <h2 id={usersId} className="font-medium">
            Userlar
          </h2>
          <ReplaceOwnerDialog companyId={c.id} />
        </div>
        <DataList
          label="Userlar"
          items={c.users}
          columns={memberColumns}
          getKey={(m) => m.phone}
          footer={`Jami: ${c.users.length}`}
        />
      </section>
      <section aria-labelledby={billingId} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id={billingId} className="font-medium">
            Billing tarixi
          </h2>
          <AddBillingDialog company={c} />
        </div>
        <BillingHistory companyId={c.id} />
      </section>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <h1 className="text-xl font-semibold">Kompaniya topilmadi</h1>
      <p className="text-sm text-muted-foreground">Bunday kompaniya yo&apos;q yoki havola noto&apos;g&apos;ri.</p>
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
