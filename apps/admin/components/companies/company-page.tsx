"use client"

import { Building2Icon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { Avatar } from "@/components/avatar"
import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { RoleBadge } from "@/components/role-badge"
import { Failed, Loading } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { formatDate, formatPhone } from "@/lib/format"
import { useCompany } from "@/lib/queries"
import type { Member } from "@/lib/types"
import { cn } from "@/lib/utils"
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

// CompanyPage shows one company: how its subscription stands, who is in it
// and what has been paid. Each part is a section under its own heading, with
// at most one action beside it; the page's one solid button adds a payment.
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
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/companies", label: "Kompaniyalar" }}
        avatar={
          <Avatar
            name={c.name}
            seed={c.id}
            icon={Building2Icon}
            square
            className="size-10 text-base md:size-11 md:rounded-xl"
          />
        }
        title={c.name}
        stack
        actions={
          <>
            <RenameDialog company={c} />
            <CompanyActions company={c} />
          </>
        }
      />
      <section aria-labelledby={infoId}>
        <SectionHeading id={infoId}>Ma&apos;lumot</SectionHeading>
        {/* One frame of three cells, not three cards: these are facts about one thing. */}
        <dl className="mt-3 grid divide-y rounded-xl border bg-card tabular-nums sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Detail label="Tugash sanasi">{formatDate(c.end_date)}</Detail>
          <Detail label="Holat" className="flex items-center sm:h-6">
            <CompanyStatusBadge company={c} />
          </Detail>
          <Detail label="Yaratilgan" className="font-normal">
            {formatDate(c.created_at)}
          </Detail>
        </dl>
      </section>
      <section aria-labelledby={usersId}>
        <SectionHeading id={usersId} action={<ReplaceOwnerDialog companyId={c.id} />}>
          Userlar
        </SectionHeading>
        <div className="mt-3">
          <DataList
            label="Userlar"
            items={c.users}
            columns={memberColumns}
            getKey={(m) => m.phone}
            footer={`Jami: ${c.users.length}`}
          />
        </div>
      </section>
      <section aria-labelledby={billingId}>
        <SectionHeading id={billingId} action={<AddBillingDialog company={c} />}>
          Billing tarixi
        </SectionHeading>
        <div className="mt-3">
          <BillingHistory companyId={c.id} />
        </div>
      </section>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Kompaniya topilmadi</h1>
      <p className="text-sm text-muted-foreground">Bunday kompaniya yo&apos;q yoki havola noto&apos;g&apos;ri.</p>
      <Link href="/companies" className={buttonVariants({ variant: "outline", size: "lg" })}>
        Kompaniyalar ro&apos;yxatiga
      </Link>
    </div>
  )
}

// SectionHeading names a section, with what can be done to it across from
// the name. The line is as tall with a button as without, so the sections
// keep one rhythm.
function SectionHeading({ id, action, children }: { id: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <h2 id={id} className="text-base leading-6 font-semibold">
        {children}
      </h2>
      {action}
    </div>
  )
}

// Detail is one fact about the company: on a phone its name and value share
// a line, from sm up the value stands under the name.
function Detail({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:py-4">
      <dt className="text-[0.8125rem] leading-5 text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-medium sm:mt-1 sm:text-base", className)}>{children}</dd>
    </div>
  )
}
