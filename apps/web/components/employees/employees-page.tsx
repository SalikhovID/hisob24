"use client"

import { type Column, DataList } from "@/components/data-list"
import { Identity } from "@/components/identity"
import { PageHeader } from "@/components/page-header"
import { Failed, ListLoading } from "@/components/states"
import { RoleBadge } from "@/components/role-badge"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useEmployees } from "@/lib/queries"
import type { Member } from "@/lib/types"
import { useOwner } from "@/lib/use-gate"
import { AddEmployeeDialog } from "./add-employee-dialog"
import { RemoveEmployeeButton } from "./remove-employee-button"
import { RenameEmployeeDialog } from "./rename-employee-dialog"

// EmployeesPage is the company's members, for its owner: the owner first,
// then the employees in the order they joined, each under the name they go
// by in this company. An employee who opens it is sent home (the API would
// refuse them all the same): the sidebar shows them no way here.
export function EmployeesPage() {
  const owner = useOwner()
  const employees = useEmployees(owner ? owner.company.id : null)

  if (!owner) return null
  const ownPhone = owner.user.phone
  const companyId = owner.company.id
  const companyName = owner.company.name

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
          mark={m.phone === ownPhone && <Badge variant="outline">Siz</Badge>}
        />
      ),
    },
    { header: "Rol", card: "tag", cell: (m) => <RoleBadge role={m.role} /> },
    {
      header: "Qo'shilgan",
      card: "inline",
      // Beside the open sidebar a narrow table has no room for it: the date
      // is context, and the card on a phone still shows it.
      className: "text-muted-foreground max-lg:hidden",
      cell: (m) => formatDate(m.created_at),
    },
    {
      header: "Amallar",
      actions: true,
      // The owner is the admin panel's to change: only employees get these.
      cell: (m) =>
        m.role === "user" && (
          <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
            <RenameEmployeeDialog companyId={companyId} employee={m} />
            <RemoveEmployeeButton companyId={companyId} companyName={companyName} employee={m} />
          </span>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Xodimlar"
        description={
          employees.data ? `Kompaniyangiz a'zolari · ${employees.data.length} kishi` : "Kompaniyangiz a'zolari"
        }
        actions={<AddEmployeeDialog companyId={companyId} />}
      />
      {employees.isPending && <ListLoading />}
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
        <p className="px-1 text-sm text-pretty text-muted-foreground md:px-4">
          Hali xodim yo&apos;q. Xodim qo&apos;shsangiz, u o&apos;z telefon raqami bilan tizimga kiradi.
        </p>
      )}
    </div>
  )
}
