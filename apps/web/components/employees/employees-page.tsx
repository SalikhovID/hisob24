"use client"

import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { Foot, Group, Row } from "@/components/kit/group"
import { PageTitle, PlusButton } from "@/components/kit/page-title"
import { RoleBadge } from "@/components/role-badge"
import { Failed, ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useEmployees } from "@/lib/queries"
import { usePermission } from "@/lib/use-gate"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"
import { AddEmployeeDialog } from "./add-employee-dialog"
import { EmployeeSheet, locationsText } from "./employee-sheet"

// EmployeesPage is the company's members, for whoever may see them (the
// owner, and an employee whose role holds employees.view), as the
// prototype's list: the owner first, then the employees in the order they
// joined, each a row by the name they go by in this company (the phone
// under it), «Siz» beside one's own, the role at its end and, with two or
// more locations, where they work under it. A row opens the member's sheet,
// where they are renamed, given a role, restricted to some locations and
// removed (each with its permission); the plus adds an employee. Anyone
// without the page's permission is sent home: the menu shows them no way here.
export function EmployeesPage() {
  const gate = usePermission("employees.view")
  const employees = useEmployees(gate ? gate.company.id : null)
  const { locations } = useLocation()
  const severalLocations = locations.length >= 2
  const [adding, setAdding] = useState(false)
  // The member whose sheet is open, by phone: the sheet follows the list as it changes.
  const [opened, setOpened] = useState<string | null>(null)

  if (!gate) return null
  const ownPhone = gate.user.phone
  const allowed = (permission: Parameters<typeof can>[1]) => can(gate.permissions, permission)
  // The roles and the locations are the owner's to give (logic/roles.md, section 5; logic/locations.md, section 5).
  const isOwner = gate.company.role === "owner"
  const members = employees.data
  const open = members?.find((m) => m.phone === opened)

  return (
    <>
      <PageTitle
        title="Xodimlar"
        description={members ? `Kompaniyangiz a'zolari · ${members.length} kishi` : "Kompaniyangiz a'zolari"}
        action={allowed("employees.create") && <PlusButton label="Xodim qo'shish" onClick={() => setAdding(true)} />}
      />
      {employees.isPending && <ListLoading />}
      {employees.isError && <Failed error={employees.error} onRetry={() => employees.refetch()} />}
      {members && (
        <>
          <Group label="Xodimlar" inset="icon">
            {members.map((m) => {
              const where = locationsText(m)
              return (
                <Row
                  key={m.phone}
                  onClick={() => setOpened(m.phone)}
                  media={<Avatar name={m.full_name} seed={m.phone} />}
                  // A member with no name goes by the phone, which then is not said twice.
                  title={m.full_name ?? formatPhone(m.phone)}
                  badge={m.phone === ownPhone && <Badge>Siz</Badge>}
                  sub={m.full_name ? formatPhone(m.phone) : undefined}
                  end={<RoleBadge role={m.role} name={m.role_name} />}
                  endSub={severalLocations && <span className={cn(where === "—" && "text-destructive")}>{where}</span>}
                  chevron={false}
                />
              )
            })}
          </Group>
          <Foot className="-mt-4">Jami: {members.length}. Xodim o&apos;z raqami bilan SMS kod yoki Telegram bot orqali kiradi.</Foot>
          {members.every((m) => m.role === "owner") && (
            <Foot>Hali xodim yo&apos;q. Xodim qo&apos;shsangiz, u o&apos;z telefon raqami bilan tizimga kiradi.</Foot>
          )}
        </>
      )}
      {adding && <AddEmployeeDialog companyId={gate.company.id} open onOpenChange={(next) => !next && setAdding(false)} />}
      {open && (
        <EmployeeSheet
          companyId={gate.company.id}
          companyName={gate.company.name}
          employee={open}
          you={open.phone === ownPhone}
          can={{ rename: allowed("employees.edit"), remove: allowed("employees.delete"), role: isOwner, locations: isOwner }}
          severalLocations={severalLocations}
          open
          onOpenChange={(next) => !next && setOpened(null)}
        />
      )}
    </>
  )
}
