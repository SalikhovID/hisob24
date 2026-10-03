"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { Failed, Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useEmployees, useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import type { Member } from "@/lib/types"
import { AddEmployeeDialog } from "./add-employee-dialog"
import { RemoveEmployeeButton } from "./remove-employee-button"
import { RenameEmployeeDialog } from "./rename-employee-dialog"

// EmployeesPage is the company's members, for its owner: the owner first,
// then the employees in the order they joined, each under the name they go
// by in this company. An employee who opens it is sent home (the API would
// refuse them all the same): the sidebar shows them no way here.
export function EmployeesPage() {
  const router = useRouter()
  const me = useMe()
  const company = me.data?.company
  const isOwner = company?.role === "owner"
  const employees = useEmployees(isOwner ? company.id : null)
  const stranger = company !== undefined && company !== null && !isOwner

  useEffect(() => {
    if (stranger) router.replace("/")
  }, [stranger, router])

  if (!me.data || !isOwner) return null
  const ownPhone = me.data.user.phone
  const companyId = company.id
  const companyName = company.name

  const columns: Column<Member>[] = [
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
    {
      header: "Rol",
      cell: (m) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-1">
          <Badge variant={m.role === "owner" ? "default" : "secondary"}>{roleLabels[m.role]}</Badge>
          {m.phone === ownPhone && <Badge variant="outline">Siz</Badge>}
        </span>
      ),
    },
    { header: "Qo'shilgan", cell: (m) => formatDate(m.created_at) },
    {
      header: "Amallar",
      // The owner is the admin panel's to change: only employees get these.
      cell: (m) =>
        m.role === "user" && (
          <span className="inline-flex items-center justify-end gap-1">
            <RenameEmployeeDialog companyId={companyId} employee={m} />
            <RemoveEmployeeButton companyId={companyId} companyName={companyName} employee={m} />
          </span>
        ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader
        title="Xodimlar"
        description={
          employees.data ? `Kompaniyangiz a'zolari · ${employees.data.length} kishi` : "Kompaniyangiz a'zolari"
        }
        actions={<AddEmployeeDialog companyId={companyId} />}
      />
      {employees.isPending && <Loading />}
      {employees.isError && <Failed error={employees.error} onRetry={() => employees.refetch()} />}
      {employees.data && (
        <DataList
          label="Xodimlar"
          items={employees.data}
          columns={columns}
          getKey={(m) => m.phone}
          footer={`Jami: ${employees.data.length}`}
        />
      )}
      {employees.data?.every((m) => m.role === "owner") && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Hali xodim yo&apos;q. Xodim qo&apos;shsangiz, u o&apos;z telefon raqami bilan tizimga kiradi.
        </p>
      )}
    </div>
  )
}
