"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { Failed, Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
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
      cell: (m) => (
        <Identity title={m.full_name ?? "—"} subtitle={formatPhone(m.phone)} name={m.full_name} seed={m.phone} />
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Xodimlar</h1>
        <AddEmployeeDialog companyId={companyId} />
      </div>
      {employees.isPending && <Loading />}
      {employees.isError && <Failed error={employees.error} onRetry={() => employees.refetch()} />}
      {employees.data && (
        <DataList label="Xodimlar" items={employees.data} columns={columns} getKey={(m) => m.phone} />
      )}
      {employees.data?.every((m) => m.role === "owner") && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Hali xodim yo&apos;q. Xodim qo&apos;shsangiz, u o&apos;z telefon raqami bilan tizimga kiradi.
        </p>
      )}
    </div>
  )
}
