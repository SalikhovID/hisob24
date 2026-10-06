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
import { can } from "@/lib/permissions"
import type { Member } from "@/lib/types"
import { usePermission } from "@/lib/use-gate"
import { AddEmployeeDialog } from "./add-employee-dialog"
import { RemoveEmployeeButton } from "./remove-employee-button"
import { RenameEmployeeDialog } from "./rename-employee-dialog"

// EmployeesPage is the company's members, for whoever may see them (the
// owner, and an employee whose role holds employees.view): the owner first,
// then the employees in the order they joined, each under the name they go
// by in this company and with the role they hold. Adding, renaming and
// removing each take their permission; anyone without the page's is sent
// home (the API would refuse them all the same): the menu shows them no
// way here.
export function EmployeesPage() {
  const gate = usePermission("employees.view")
  const employees = useEmployees(gate ? gate.company.id : null)

  if (!gate) return null
  const ownPhone = gate.user.phone
  const companyId = gate.company.id
  const companyName = gate.company.name
  const allowed = (permission: Parameters<typeof can>[1]) => can(gate.permissions, permission)

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
    { header: "Rol", card: "tag", cell: (m) => <RoleBadge role={m.role} name={m.role_name} /> },
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
      // The owner is the admin panel's to change: only employees get these,
      // and only from someone whose permissions hold the action.
      cell: (m) =>
        m.role === "user" &&
        (allowed("employees.edit") || allowed("employees.delete")) && (
          <span className="inline-flex items-center justify-end gap-1 max-md:gap-2 pointer-coarse:gap-2">
            {allowed("employees.edit") && <RenameEmployeeDialog companyId={companyId} employee={m} />}
            {allowed("employees.delete") && <RemoveEmployeeButton companyId={companyId} companyName={companyName} employee={m} />}
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
        actions={allowed("employees.create") && <AddEmployeeDialog companyId={companyId} />}
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
