"use client"

import { type Column, DataList } from "@/components/data-list"
import { Loading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { formatPhone } from "@/lib/phone"
import { useEmployees, useMe } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import type { Member } from "@/lib/types"

// EmployeesPage is the company's members, for its owner: the owner first,
// then the employees in the order they joined, each under the name they go
// by in this company.
export function EmployeesPage() {
  const me = useMe()
  const company = me.data?.company
  const employees = useEmployees(company?.role === "owner" ? company.id : null)
  if (!me.data || !company) return null
  const ownPhone = me.data.user.phone

  const columns: Column<Member>[] = [
    { header: "Telefon", cell: (m) => formatPhone(m.phone), primary: true },
    { header: "Ism", cell: (m) => m.full_name ?? "—" },
    {
      header: "Rol",
      cell: (m) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-1">
          <Badge variant={m.role === "owner" ? "default" : "secondary"}>{roleLabels[m.role]}</Badge>
          {m.phone === ownPhone && <Badge variant="outline">Siz</Badge>}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Xodimlar</h1>
      {employees.isPending && <Loading />}
      {employees.data && (
        <DataList label="Xodimlar" items={employees.data} columns={columns} getKey={(m) => m.phone} />
      )}
    </div>
  )
}
